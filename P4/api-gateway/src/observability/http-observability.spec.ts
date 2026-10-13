import type { AddressInfo } from 'node:net';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { correlationContext, registry, requestObservabilityMiddleware, startMetricsServer } from './http-observability';

describe('API Gateway observability', () => {
  it('keeps the correlation ID available to downstream calls', async () => {
    await correlationContext.run('rental-flow-123', async () => {
      expect(correlationContext.getStore()).toBe('rental-flow-123');
      await Promise.resolve();
      expect(correlationContext.getStore()).toBe('rental-flow-123');
    });
  });

  it('serves Prometheus metrics on the separate metrics listener', async () => {
    const server = startMetricsServer(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    try {
      const response = await fetch(`http://127.0.0.1:${port}/metrics`);
      const body = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/plain');
      expect(body).toContain('# HELP comicrent_http_requests_total');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('marks controlled canary probes separately from user traffic', async () => {
    const request = {
      path: '/canary-probe-test',
      method: 'GET',
      header: (name: string) => name === 'x-comicrent-observability-probe' ? 'canary' : undefined,
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), {
      statusCode: 200,
      setHeader: jest.fn(),
    }) as unknown as Response;

    requestObservabilityMiddleware()(request, response, () => undefined);
    response.emit('finish');

    const metrics = await registry.metrics();
    expect(metrics).toContain('route="/canary-probe-test",status_class="2xx",traffic_source="canary-test"');
    expect(metrics).not.toContain('route="/canary-probe-test",status_class="2xx",traffic_source="user"');
  });
});
