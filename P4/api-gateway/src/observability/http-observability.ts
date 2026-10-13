import { randomUUID } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import { createServer } from 'node:http';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { trace } from '@opentelemetry/api';
import {
  collectDefaultMetrics,
  Counter,
  Histogram,
  Registry,
} from '@prometheus-io/client';

const SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'api-gateway';
const CORRELATION_ID_HEADER = 'x-correlation-id';
const VALID_CORRELATION_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const correlationContext = new AsyncLocalStorage<string>();
export const registry = new Registry();

registry.setDefaultLabels({ service: SERVICE_NAME });
collectDefaultMetrics({ register: registry, prefix: 'comicrent_' });

export const httpRequestsTotal = new Counter({
  name: 'comicrent_http_requests_total',
  help: 'HTTP requests completed by a ComicRent service.',
  labelNames: ['method', 'route', 'status_class', 'traffic_source'],
  registers: [registry],
});

export const httpRequestDurationSeconds = new Histogram({
  name: 'comicrent_http_request_duration_seconds',
  help: 'Duration of completed HTTP requests in seconds.',
  labelNames: ['method', 'route', 'status_class', 'traffic_source'],
  buckets: [0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10],
  registers: [registry],
});

export function startMetricsServer(
  port = Number(process.env.METRICS_PORT ?? 9464),
) {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/metrics') {
      response.statusCode = 404;
      response.end('Not found');
      return;
    }

    response.statusCode = 200;
    response.setHeader('Content-Type', registry.contentType);
    response.end(await registry.metrics());
  }).listen(port, '0.0.0.0');
}

function correlationIdFrom(request: Request): string {
  const candidate = request.header(CORRELATION_ID_HEADER)?.trim();
  return candidate && VALID_CORRELATION_ID.test(candidate)
    ? candidate
    : randomUUID();
}

function routeFor(request: Request): string {
  return request.path
    .replace(/\/[0-9]+(?=\/|$)/g, '/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}(?=\/|$)/gi, '/:id');
}

function statusClass(statusCode: number): string {
  return `${Math.floor(statusCode / 100)}xx`;
}

function isTelemetryEndpoint(path: string): boolean {
  return path === '/metrics' || path === '/health';
}

export function requestObservabilityMiddleware(): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    const correlationId = correlationIdFrom(request);
    const startedAt = process.hrtime.bigint();
    const spanContext = trace.getActiveSpan()?.spanContext();
    const traceId = spanContext?.traceId ?? null;
    const spanId = spanContext?.spanId ?? null;
    // A bounded label keeps controlled canary probes out of the user SLO.
    const trafficSource =
      request.header('x-comicrent-observability-probe') === 'canary'
        ? 'canary-test'
        : 'user';
    let finished = false;

    response.setHeader('X-Correlation-ID', correlationId);

    correlationContext.run(correlationId, () => {
      const recordRequest = (statusCode: number, outcome: string): void => {
        if (isTelemetryEndpoint(request.path)) {
          return;
        }

        const route = routeFor(request);
        const method = request.method.toUpperCase();
        const durationSeconds =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;

        httpRequestsTotal.inc({
          method,
          route,
          status_class: outcome,
          traffic_source: trafficSource,
        });
        httpRequestDurationSeconds.observe(
          { method, route, status_class: outcome, traffic_source: trafficSource },
          durationSeconds,
        );

        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level:
              outcome === 'timeout'
                ? 'WARN'
                : statusCode >= 500
                  ? 'ERROR'
                  : 'INFO',
            service: SERVICE_NAME,
            event:
              outcome === 'timeout'
                ? 'http.request.aborted'
                : 'http.request.completed',
            trace_id: traceId,
            span_id: spanId,
            correlation_id: correlationId,
            method,
            route,
            status_code: statusCode || null,
            traffic_source: trafficSource,
            duration_ms: Number((durationSeconds * 1000).toFixed(3)),
          }),
        );
      };

      response.once('finish', () => {
        finished = true;
        recordRequest(response.statusCode, statusClass(response.statusCode));
      });
      response.once('close', () => {
        if (!finished) {
          recordRequest(0, 'timeout');
        }
      });

      next();
    });
  };
}
