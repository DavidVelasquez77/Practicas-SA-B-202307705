"""Capture the successful public-traffic Canary decision as read-only evidence."""

from __future__ import annotations

import json
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "evidence"


def kube(*args: str) -> dict:
    proc = subprocess.run(["kubectl", *args, "-o", "json"], capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def prom(expr: str) -> dict:
    url = "http://127.0.0.1:33001/api/v1/query?" + urllib.parse.urlencode({"query": expr})
    with urllib.request.urlopen(url, timeout=40) as response:
        result = json.load(response)
    if result["status"] != "success":
        raise RuntimeError(result)
    return {"promql": expr, "result": result["data"]["result"]}


def main() -> None:
    rollout = kube("get", "rollout", "comicrent-api-gateway-rollout", "-n", "sa-p9")
    service = kube("get", "svc", "comicrent-p9-workloads-api-gateway", "-n", "sa-p9")
    runs = kube("get", "analysisruns", "-n", "sa-p9")
    traffic = json.loads((EVIDENCE / "public-canary-traffic.json").read_text(encoding="utf-8"))
    candidate = traffic["rollout_observations"][-1]["current_hash"]
    selected_runs = [r for r in runs["items"] if f"-{candidate}-" in r["metadata"]["name"]]
    selected_runs.sort(key=lambda r: r["metadata"]["creationTimestamp"])
    metrics = {}
    for label, extra in {"user_requests": "", "server_errors": ',status_class=~"5xx|timeout"', "probe_requests": ',traffic_source="canary-test"'}.items():
        source = ',traffic_source="user"' if label != "probe_requests" else ""
        expr = f'sum(increase(comicrent_http_requests_total{{namespace="sa-p9",service="api-gateway",rollouts_pod_template_hash="{candidate}"{source}{extra}}}[30m])) or vector(0)'
        metrics[label] = prom(expr)
    output = {
        "captured_at_utc": datetime.now(timezone.utc).isoformat(),
        "traffic": traffic,
        "public_service": {"name": service["metadata"]["name"], "external_ip": service["status"]["loadBalancer"]["ingress"][0]["ip"], "selector": service["spec"]["selector"]},
        "rollout": {"name": rollout["metadata"]["name"], "phase": rollout["status"].get("phase"), "step": rollout["status"].get("currentStepIndex"), "stable_hash": rollout["status"].get("stableRS"), "replicas": rollout["status"].get("replicas"), "ready_replicas": rollout["status"].get("readyReplicas")},
        "analysisruns": [{"name": r["metadata"]["name"], "phase": r.get("status", {}).get("phase"), "metrics": [{"name": m["name"], "phase": m.get("phase"), "measurements": m.get("measurements", [])} for m in r.get("status", {}).get("metricResults", [])]} for r in selected_runs],
        "prometheus": metrics,
    }
    path = EVIDENCE / "public-canary-proof.json"
    path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(path)
    print("AnalysisRuns:", [(x["name"], x["phase"]) for x in output["analysisruns"]])
    print("Prometheus:", {k: v["result"][0]["value"][1] if v["result"] else None for k, v in metrics.items()})


if __name__ == "__main__":
    main()
