import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { NoopSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeSDK } from "@opentelemetry/sdk-node";

const serviceName = process.env.OTEL_SERVICE_NAME ?? "auth-service";
const hasCollector = Boolean(
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT,
);

process.env.OTEL_SERVICE_NAME = serviceName;
process.env.OTEL_PROPAGATORS ??= "tracecontext,baggage";
process.env.OTEL_METRICS_EXPORTER ??= "none";
process.env.OTEL_LOGS_EXPORTER ??= "none";

const sdk = new NodeSDK({
  ...(hasCollector
    ? { traceExporter: new OTLPTraceExporter() }
    : { spanProcessors: [new NoopSpanProcessor()] }),
  instrumentations: [new HttpInstrumentation(), new UndiciInstrumentation()],
});

sdk.start();

export function shutdownTelemetry(): Promise<void> {
  return sdk.shutdown();
}
