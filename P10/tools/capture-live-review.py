"""Capture read-only P10 review evidence from the local Prometheus port-forward.

Run `kubectl port-forward -n observability svc/p10-observability-kube-pro-prometheus
33001:9090` in another terminal first. The output records observed values, never
fabricates a completed 30-day history.
"""

from __future__ import annotations

import json
import subprocess
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "evidence" / "live-review-snapshot.json"

QUERIES = {
    "user_requests_24h": 'sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user"}[24h])) or vector(0)',
    "user_availability_24h": '1 - ((sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user",status_class=~"5xx|timeout"}[24h])) or vector(0)) / sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user"}[24h])))',
    "user_fast_ratio_24h": 'sum(increase(comicrent_http_request_duration_seconds_bucket{namespace="sa-p9",service="api-gateway",traffic_source="user",le="0.5"}[24h])) / sum(increase(comicrent_http_request_duration_seconds_count{namespace="sa-p9",service="api-gateway",traffic_source="user"}[24h]))',
    "history_days_available": '(time() - min(min_over_time(timestamp(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user"})[30d:1h]))) / 86400',
    "availability_record_30d_partial": "comicrent:slo:availability:good_ratio_30d",
    "latency_record_30d_partial": "comicrent:slo:latency:good_ratio_30d",
    "availability_budget_30d_partial": "comicrent:slo:availability:budget_consumed_ratio_30d",
    "latency_budget_30d_partial": "comicrent:slo:latency:budget_consumed_ratio_30d",
}


def query(expr: str) -> dict:
    url = "http://127.0.0.1:33001/api/v1/query?" + urllib.parse.urlencode({"query": expr})
    with urllib.request.urlopen(url, timeout=45) as response:
        payload = json.load(response)
    if payload.get("status") != "success":
        raise RuntimeError(f"Prometheus query failed: {payload}")
    values = payload["data"]["result"]
    return {"promql": expr, "value": float(values[0]["value"][1]) if values else None}


def kube(*args: str) -> dict:
    proc = subprocess.run(["kubectl", *args, "-o", "json"], capture_output=True, text=True, check=True)
    return json.loads(proc.stdout)


def main() -> None:
    output = {
        "captured_at_utc": datetime.now(timezone.utc).isoformat(),
        "interpretation": "30d recording rules are active but history is incomplete until 30 days have elapsed; 24h indicators are observed evidence, not a replacement SLO.",
        "metrics": {name: query(expr) for name, expr in QUERIES.items()},
    }
    apps = kube("get", "applications", "-n", "argocd")
    output["argocd"] = [
        {"name": item["metadata"]["name"], "sync": item.get("status", {}).get("sync", {}).get("status"), "health": item.get("status", {}).get("health", {}).get("status")}
        for item in apps["items"]
    ]
    rule = kube("get", "prometheusrule", "comicrent-slo-rules", "-n", "observability")
    output["prometheus_rule"] = {
        "name": rule["metadata"]["name"],
        "recording_rules": [r["record"] for g in rule["spec"]["groups"] for r in g["rules"] if "record" in r],
        "alerts": [{"name": r["alert"], "runbook_url": r.get("annotations", {}).get("runbook_url")} for g in rule["spec"]["groups"] for r in g["rules"] if "alert" in r],
    }
    rollout = kube("get", "rollout", "comicrent-api-gateway-rollout", "-n", "sa-p9")
    output["rollout"] = {
        "name": rollout["metadata"]["name"],
        "ready_replicas": rollout.get("status", {}).get("readyReplicas"),
        "replicas": rollout.get("status", {}).get("replicas"),
        "current_step_index": rollout.get("status", {}).get("currentStepIndex"),
    }
    OUT.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(OUT)


if __name__ == "__main__":
    main()
