"""Generate a bounded batch of fictitious login requests for the P10 dashboard.

By default requests are labelled canary-test, keeping them out of user SLOs
and rollout analysis. The optional user source is counted toward the latency
SLO. Requests expect HTTP 401 and do not mutate business data or change a
Rollout revision.
"""

from __future__ import annotations

import argparse
import json
import subprocess
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4


SERVICE = "comicrent-p9-workloads-api-gateway"
ROLLOUT = "comicrent-api-gateway-rollout"
NAMESPACE = "sa-p9"


def kubectl_json(*args: str) -> dict:
    result = subprocess.run(
        ["kubectl", *args, "-o", "json"],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(result.stdout)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send bounded fake-login traffic (expected HTTP 401) for Grafana/Loki/Tempo demo."
    )
    parser.add_argument("--requests", type=int, default=20, help="Number of requests (1–50; default: 20).")
    parser.add_argument("--interval", type=float, default=1.0, help="Seconds between requests (0.5–5; default: 1).")
    parser.add_argument(
        "--traffic-source",
        choices=("canary-test", "user"),
        default="canary-test",
        help="canary-test is excluded from user SLOs; user requests count toward latency SLOs.",
    )
    args = parser.parse_args()
    if not 1 <= args.requests <= 50:
        parser.error("--requests must be between 1 and 50")
    if not 0.5 <= args.interval <= 5:
        parser.error("--interval must be between 0.5 and 5 seconds")

    service = kubectl_json("get", "svc", SERVICE, "-n", NAMESPACE)
    ingress = service.get("status", {}).get("loadBalancer", {}).get("ingress", [])
    if not ingress or not (host := ingress[0].get("ip") or ingress[0].get("hostname")):
        raise SystemExit("El Service publico no tiene una IP/dominio asignado.")

    rollout = kubectl_json("get", "rollout", ROLLOUT, "-n", NAMESPACE)
    phase = rollout.get("status", {}).get("phase")
    if phase != "Healthy":
        raise SystemExit(f"El Canary no está Healthy (estado actual: {phase!r}); no se envió tráfico.")

    url = f"http://{host}:3000/api/auth/login"
    body = json.dumps(
        {"correo": "demo-observability@example.invalid", "contrasena": "invalid-demo-only"}
    ).encode("utf-8")
    counts: Counter[int | str] = Counter()
    correlation_ids: list[str] = []
    print(f"Inicio UTC: {utc_now()}")
    print(f"Destino: {SERVICE} /api/auth/login; Canary: Healthy")
    print(f"Origen de trafico: {args.traffic_source}")
    print("Solo se usaran credenciales ficticias; respuesta esperada: HTTP 401.")
    if args.traffic_source == "canary-test":
        print("Las sondas quedan separadas del SLO de usuario y del analisis de promocion.")
    else:
        print("AVISO: estas solicitudes de usuario tambien se miden para el SLO de latencia.")

    for index in range(args.requests):
        correlation_id = f"p10-demo-{datetime.now(timezone.utc):%Y%m%dT%H%M%SZ}-{uuid4().hex[:8]}"
        correlation_ids.append(correlation_id)
        headers = {
            "Content-Type": "application/json",
            "X-Correlation-ID": correlation_id,
        }
        if args.traffic_source == "canary-test":
            headers["X-ComicRent-Observability-Probe"] = "canary"
        request = urllib.request.Request(
            url,
            data=body,
            headers=headers,
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=10) as response:
                status: int | str = response.status
                returned_id = response.headers.get("X-Correlation-ID", "")
        except urllib.error.HTTPError as error:
            status = error.code
            returned_id = error.headers.get("X-Correlation-ID", "")
        except Exception as error:  # preserve a clear result for network failures
            status = type(error).__name__
            returned_id = ""
        counts[status] += 1
        print(f"{index + 1:02}/{args.requests}: HTTP {status}; correlation_id={returned_id or correlation_id}")
        if index + 1 < args.requests:
            time.sleep(args.interval)

    print(f"Fin UTC: {utc_now()}")
    print(f"Resumen: {dict(counts)}")
    print(f"IDs para buscar en Loki: primero={correlation_ids[0]} ultimo={correlation_ids[-1]}")
    if counts != Counter({401: args.requests}):
        print("ERROR: no todas las solicitudes tuvieron el 401 esperado; revisa la salida antes de la demo.")
        return 1
    print("OK: trafico de demostracion completado; no se crearon rentas ni se cambio la revision Canary.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
