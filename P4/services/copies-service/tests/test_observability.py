import json
import unittest
from contextlib import redirect_stdout
from io import StringIO
from urllib.request import urlopen

from opentelemetry import trace

from app.observability import (
    CorrelationAndMetricsMiddleware,
    HTTP_REQUESTS,
    start_metrics_server,
)


class ObservabilityTests(unittest.IsolatedAsyncioTestCase):
    async def test_json_access_log_has_trace_and_correlation_ids(self):
        async def app(scope, receive, send):
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        messages = []

        async def send(message):
            messages.append(message)

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/copies/available/by-comic/24",
            "headers": [(b"x-correlation-id", b"rental-flow-123")],
        }
        output = StringIO()

        with redirect_stdout(output):
            with trace.get_tracer("copies-observability-tests").start_as_current_span(
                "copies.find-available"
            ) as span:
                await CorrelationAndMetricsMiddleware(app)(scope, receive, send)

        response_headers = dict(messages[0]["headers"])
        self.assertEqual(response_headers[b"x-correlation-id"], b"rental-flow-123")
        record = json.loads(output.getvalue().strip())
        self.assertEqual(record["service"], "copies-service")
        self.assertEqual(record["trace_id"], format(span.get_span_context().trace_id, "032x"))
        self.assertEqual(record["correlation_id"], "rental-flow-123")
        self.assertEqual(record["route"], "/copies/available/by-comic/:id")

    async def test_prometheus_endpoint_uses_internal_listener(self):
        HTTP_REQUESTS.labels(
            service="copies-service",
            method="GET",
            route="/metrics-test",
            status_class="2xx",
        ).inc()
        server, thread = start_metrics_server(port=0)
        try:
            with urlopen(f"http://127.0.0.1:{server.server_port}/metrics") as response:
                body = response.read().decode("utf-8")
                self.assertEqual(response.status, 200)
                self.assertIn(
                    'comicrent_http_requests_total{method="GET",route="/metrics-test",service="copies-service",status_class="2xx"} 1.0',
                    body,
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)


if __name__ == "__main__":
    unittest.main()
