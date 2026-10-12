from __future__ import annotations

import json
import os
import re
import time
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.propagate import inject, set_global_textmap
from opentelemetry.baggage.propagation import W3CBaggagePropagator
from opentelemetry.propagators.composite import CompositePropagator
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import (
    CollectorRegistry,
    Counter,
    Histogram,
    PlatformCollector,
    ProcessCollector,
    start_http_server,
)


SERVICE_NAME_VALUE = os.getenv("OTEL_SERVICE_NAME", "rentals-service")
CORRELATION_HEADER = b"x-correlation-id"
VALID_CORRELATION_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$")
correlation_id_context: ContextVar[str | None] = ContextVar(
    "comicrent_correlation_id", default=None
)


def initialize_tracing() -> TracerProvider:
    """Initialize W3C tracing before the shared HTTPX client is created."""
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
    HTTPXClientInstrumentor().instrument(tracer_provider=provider)
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
RENTALS_CREATED = Counter(
    "comicrent_rentals_created_total",
    "Rentals successfully created by the business service.",
    ("service",),
    registry=REGISTRY,
)
RENTALS_RETURNED = Counter(
    "comicrent_rentals_returned_total",
    "Rentals successfully returned by the business service.",
    ("service",),
    registry=REGISTRY,
)


async def inject_correlation_id(request: Any) -> None:
    inject(request.headers)
    correlation_id = correlation_id_context.get()
    if correlation_id:
        request.headers.setdefault("X-Correlation-ID", correlation_id)


def _route_for(scope: dict[str, Any]) -> str:
    route = scope.get("route")
    path = getattr(route, "path", None) or scope.get("path", "/unknown")
    path = re.sub(r"/[0-9]+(?=/|$)", "/:id", path)
    return re.sub(
        r"/[0-9a-f]{8}-[0-9a-f-]{27,}(?=/|$)", "/:id", path, flags=re.IGNORECASE
    )


class CorrelationAndMetricsMiddleware:
    """Preserve correlation IDs and emit bounded HTTP metrics plus JSON logs."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "/")
        incoming_headers = dict(scope.get("headers", []))
        candidate = incoming_headers.get(CORRELATION_HEADER, b"").decode(
            "latin-1"
        ).strip()
        correlation_id = (
            candidate
            if VALID_CORRELATION_ID.fullmatch(candidate)
            else str(uuid4())
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
            if path not in {"/health", "/metrics"} and not path.startswith(
                "/metrics/"
            ):
                route = _route_for(scope)
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


def log_business_event(event: str) -> None:
    span_context = trace.get_current_span().get_span_context()
    print(
        json.dumps(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": "INFO",
                "service": SERVICE_NAME_VALUE,
                "event": event,
                "trace_id": f"{span_context.trace_id:032x}"
                if span_context.is_valid
                else None,
                "span_id": f"{span_context.span_id:016x}"
                if span_context.is_valid
                else None,
                "correlation_id": correlation_id_context.get(),
            },
            separators=(",", ":"),
        ),
        flush=True,
    )


def log_graphql_error(event: str, error: BaseException) -> None:
    span_context = trace.get_current_span().get_span_context()
    extensions = getattr(error, "extensions", {}) or {}
    print(
        json.dumps(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "level": "ERROR",
                "service": SERVICE_NAME_VALUE,
                "event": event,
                "trace_id": f"{span_context.trace_id:032x}"
                if span_context.is_valid
                else None,
                "span_id": f"{span_context.span_id:016x}"
                if span_context.is_valid
                else None,
                "correlation_id": correlation_id_context.get(),
                "error_type": type(error).__name__,
                "error_code": extensions.get("code"),
            },
            separators=(",", ":"),
        ),
        flush=True,
    )


def start_metrics_server(port: int | None = None) -> tuple[Any, Any]:
    selected_port = port if port is not None else int(os.getenv("METRICS_PORT", "9464"))
    return start_http_server(port=selected_port, addr="0.0.0.0", registry=REGISTRY)


def shutdown_tracing() -> None:
    TRACER_PROVIDER.shutdown()
