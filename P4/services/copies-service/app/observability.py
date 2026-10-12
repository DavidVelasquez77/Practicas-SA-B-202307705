from __future__ import annotations

import json
import os
import re
import time
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from opentelemetry import trace
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.propagate import set_global_textmap
from opentelemetry.propagators.composite import CompositePropagator
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from prometheus_client import (
    CollectorRegistry,
    Counter,
    Histogram,
    PlatformCollector,
    ProcessCollector,
    start_http_server,
)


SERVICE_NAME_VALUE = os.getenv("OTEL_SERVICE_NAME", "copies-service")
CORRELATION_HEADER = b"x-correlation-id"
VALID_CORRELATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
correlation_id_context: ContextVar[str | None] = ContextVar(
    "comicrent_correlation_id", default=None
)


def initialize_tracing() -> TracerProvider:
    resource = Resource.create({SERVICE_NAME: SERVICE_NAME_VALUE})
    provider = TracerProvider(resource=resource)
    has_collector = bool(
        os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
        or os.getenv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT")
    )
    if has_collector:
        provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))

    trace.set_tracer_provider(provider)
    set_global_textmap(
        CompositePropagator(
            [TraceContextTextMapPropagator(), W3CBaggagePropagator()]
        )
    )
    return provider


TRACER_PROVIDER = initialize_tracing()
REGISTRY = CollectorRegistry()
ProcessCollector(registry=REGISTRY)
PlatformCollector(registry=REGISTRY)

HTTP_REQUESTS = Counter(
    "comicrent_http_requests_total",
    "HTTP requests completed by a ComicRent service.",
    ("service", "method", "route", "status_class"),
    registry=REGISTRY,
)
HTTP_REQUEST_DURATION = Histogram(
    "comicrent_http_request_duration_seconds",
    "Duration of completed HTTP requests in seconds.",
    ("service", "method", "route", "status_class"),
    buckets=(0.05, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 10),
    registry=REGISTRY,
)


class CorrelationAndMetricsMiddleware:
    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        incoming_headers = dict(scope.get("headers", []))
        candidate = incoming_headers.get(CORRELATION_HEADER, b"").decode(
            "latin-1"
        ).strip()
        correlation_id = (
            candidate if VALID_CORRELATION_ID.fullmatch(candidate) else str(uuid4())
        )
        token = correlation_id_context.set(correlation_id)
        started_at = time.perf_counter()
        span_context = trace.get_current_span().get_span_context()
        trace_id = f"{span_context.trace_id:032x}" if span_context.is_valid else None
        span_id = f"{span_context.span_id:016x}" if span_context.is_valid else None
        status_code = 500
        error_type: str | None = None

        async def send_with_correlation(message: dict[str, Any]) -> None:
            nonlocal status_code
            if message.get("type") == "http.response.start":
                status_code = int(message.get("status", 500))
                headers = list(message.get("headers", []))
                if not any(name.lower() == CORRELATION_HEADER for name, _ in headers):
                    headers.append((CORRELATION_HEADER, correlation_id.encode()))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_with_correlation)
        except Exception as exc:
            error_type = type(exc).__name__
            raise
        finally:
            path = scope.get("path", "/")
            if path not in {"/health", "/metrics"} and not path.startswith("/metrics/"):
                route = re.sub(r"/[0-9]+(?=/|$)", "/:id", path)
                route = re.sub(
                    r"/[0-9a-f]{8}-[0-9a-f-]{27,}(?=/|$)",
                    "/:id",
                    route,
                    flags=re.IGNORECASE,
                )
                method = scope.get("method", "GET").upper()
                status_class = f"{status_code // 100}xx"
                duration_seconds = time.perf_counter() - started_at
                labels = {
                    "service": SERVICE_NAME_VALUE,
                    "method": method,
                    "route": route,
                    "status_class": status_class,
                }
                HTTP_REQUESTS.labels(**labels).inc()
                HTTP_REQUEST_DURATION.labels(**labels).observe(duration_seconds)
                print(
                    json.dumps(
                        {
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                            "level": "ERROR" if status_code >= 500 else "INFO",
                            "service": SERVICE_NAME_VALUE,
                            "event": "http.request.completed",
                            "trace_id": trace_id,
                            "span_id": span_id,
                            "correlation_id": correlation_id,
                            "method": method,
                            "route": route,
                            "status_code": status_code,
                            "duration_ms": round(duration_seconds * 1000, 3),
                            **({"error_type": error_type} if error_type else {}),
                        },
                        separators=(",", ":"),
                    ),
                    flush=True,
                )
            correlation_id_context.reset(token)


def instrument_fastapi(app: Any) -> None:
    app.add_middleware(CorrelationAndMetricsMiddleware)
    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=TRACER_PROVIDER,
        excluded_urls="/health,/metrics",
    )


def start_metrics_server(port: int | None = None) -> tuple[Any, Any]:
    selected_port = port if port is not None else int(os.getenv("METRICS_PORT", "9464"))
    return start_http_server(port=selected_port, addr="0.0.0.0", registry=REGISTRY)


def shutdown_tracing() -> None:
    TRACER_PROVIDER.shutdown()
