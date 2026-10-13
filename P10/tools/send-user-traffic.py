"""Exercise the public gateway during a P10 metric-gated Canary review.

These requests use the normal LoadBalancer Service and no Canary-probe header.
They use fictitious invalid credentials and only expect HTTP 401; no account or
business data is created. The script stops when a new Rollout hash is Healthy.
"""

from __future__ import annotations

import json
import argparse
import subprocess
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


EVIDENCE = Path(__file__).resolve().parents[1] / "evidence"
SERVICE = "comicrent-p9-workloads-api-gateway"
ROLLOUT = "comicrent-api-gateway-rollout"


def kubectl(*args: str) -> dict:
    proc = subprocess.run(["kubectl", *args, "-o", "json"], capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--expect-abort", action="store_true", help="Stop after candidate analysis fails")
    parser.add_argument("--output", default="public-canary-traffic.json")
    args = parser.parse_args()
    output_path = EVIDENCE / args.output
    service = kubectl("get", "svc", SERVICE, "-n", "sa-p9")
    host = service["status"]["loadBalancer"]["ingress"][0]["ip"]
    endpoint = f"http://{host}:3000/api/auth/login"
    initial = kubectl("get", "rollout", ROLLOUT, "-n", "sa-p9")["status"].get("stableRS")
    counts: Counter[str] = Counter()
    began = time.monotonic()
    events: list[dict] = []
    print(f"Servicio público: {SERVICE}; endpoint: {endpoint}; hash inicial: {initial}", flush=True)
    print("Inicia ahora el cambio GitOps de deploymentRevision.", flush=True)
    completed = False
    candidate_hash: str | None = None
    failed_run: str | None = None

    for index in range(900):  # max 15 min at roughly one request per second
        request = urllib.request.Request(
            endpoint,
            data=b'{"correo":"p10-evaluation@example.invalid","contrasena":"invalid-demo-only"}',
            headers={"Content-Type": "application/json", "X-Correlation-ID": f"p10-public-canary-{index}"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=4) as response:
                code = response.status
        except urllib.error.HTTPError as exc:
            code = exc.code
        except Exception as exc:  # networking failures are recorded, not hidden
            code = type(exc).__name__
        counts[str(code)] += 1
        if index % 15 == 0:
            rollout = kubectl("get", "rollout", ROLLOUT, "-n", "sa-p9")
            status = rollout.get("status", {})
            state = {"at_utc": now(), "phase": status.get("phase"), "step": status.get("currentStepIndex"), "stable_hash": status.get("stableRS"), "current_hash": status.get("currentPodHash")}
            events.append(state)
            print(f"{state} HTTP={dict(counts)}", flush=True)
            if status.get("currentPodHash") and status.get("currentPodHash") != initial:
                candidate_hash = status["currentPodHash"]
            if args.expect_abort and candidate_hash:
                runs = kubectl("get", "analysisruns", "-n", "sa-p9")
                failures = [r for r in runs["items"] if f"-{candidate_hash}-" in r["metadata"]["name"] and r.get("status", {}).get("phase") == "Failed"]
                if failures:
                    failed_run = failures[-1]["metadata"]["name"]
                    completed = True
                    break
            if not args.expect_abort and status.get("phase") == "Healthy" and status.get("stableRS") != initial and status.get("currentStepIndex", 0) >= 10:
                completed = True
                break
            if status.get("phase") == "Degraded":
                break
        time.sleep(max(0, began + index + 1 - time.monotonic()))

    evidence = {"captured_at_utc": now(), "service": SERVICE, "endpoint": endpoint, "initial_stable_hash": initial, "candidate_hash": candidate_hash, "request_counts": dict(counts), "expected_abort": args.expect_abort, "outcome_verified": completed, "failed_analysisrun": failed_run, "rollout_observations": events}
    output_path.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(f"Resultado guardado en {output_path}; condición verificada={completed}", flush=True)
    if not completed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
