import json
import unittest
from contextlib import redirect_stdout
from contextvars import Token
from io import StringIO
from urllib.request import urlopen

import httpx
from opentelemetry import trace
from prometheus_client import generate_latest

from app.observability import (
    CorrelationAndMetricsMiddleware,
    HTTP_REQUESTS,
    REGISTRY,
    correlation_id_context,
    inject_correlation_id,
    start_metrics_server,
)


class ObservabilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_business_metrics_exist_before_first_rental(self):
        metrics = generate_latest(REGISTRY).decode("utf-8")
        self.assertIn('comicrent_rentals_created_total{service="rentals-service"} 0.0', metrics)
        self.assertIn('comicrent_rentals_returned_total{service="rentals-service"} 0.0', metrics)

    async def test_httpx_hook_propagates_correlation_id(self):
        request = httpx.Request("GET", "http://copies.test/health")
        token: Token[str | None] = correlation_id_context.set("rental-flow-123")
        try:
            await inject_correlation_id(request)
        finally:
            correlation_id_context.reset(token)

        self.assertEqual(
            request.headers["x-correlation-id"], "rental-flow-123"
        )

    async def test_httpx_instrumentation_propagates_w3c_trace_context(self):
        captured_headers = {}

        async def receive_request(request):
            captured_headers.update(request.headers)
            return httpx.Response(200)

        with trace.get_tracer("observability-tests").start_as_current_span(
            "rentals-to-copies"
        ) as span:
            async with httpx.AsyncClient(
                transport=httpx.MockTransport(receive_request),
                event_hooks={"request": [inject_correlation_id]},
            ) as client:
                await client.get("http://copies.test/health")

        span_context = span.get_span_context()
        self.assertRegex(
            captured_headers["traceparent"],
            rf"^00-{span_context.trace_id:032x}-{span_context.span_id:016x}-[0-9a-f]{{2}}$",
        )

    async def test_middleware_emits_json_linked_to_active_trace(self):
        async def app(scope, receive, send):
            await send(
                {"type": "http.response.start", "status": 201, "headers": []}
            )
            await send({"type": "http.response.body", "body": b"created"})

        messages = []

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http",
            "method": "POST",
            "path": "/graphql",
            "headers": [(b"x-correlation-id", b"rental-flow-123")],
        }
        output = StringIO()

        with redirect_stdout(output):
            with trace.get_tracer("observability-tests").start_as_current_span(
                "rental-create"
            ) as span:
                await CorrelationAndMetricsMiddleware(app)(scope, receive, send)

        response_headers = dict(
            messages[0]["headers"]
        )
        self.assertEqual(response_headers[b"x-correlation-id"], b"rental-flow-123")

        record = json.loads(output.getvalue().strip())
        self.assertEqual(record["event"], "http.request.completed")
        self.assertEqual(record["correlation_id"], "rental-flow-123")
        self.assertEqual(record["trace_id"], format(span.get_span_context().trace_id, "032x"))
        self.assertEqual(record["route"], "/graphql")
        self.assertEqual(record["status_code"], 201)

    async def test_prometheus_endpoint_uses_internal_metrics_listener(self):
        HTTP_REQUESTS.labels(
            service="rentals-service",
            method="GET",
            route="/metrics-test",
            status_class="2xx",
        ).inc()
        server, thread = start_metrics_server(port=0)
        try:
            with urlopen(
                f"http://127.0.0.1:{server.server_port}/metrics"
            ) as response:
                body = response.read().decode("utf-8")
                self.assertEqual(response.status, 200)
                self.assertIn(
                    'comicrent_http_requests_total{method="GET",route="/metrics-test",service="rentals-service",status_class="2xx"} 1.0',
                    body,
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
