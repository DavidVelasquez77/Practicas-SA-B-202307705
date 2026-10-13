"""Build the Grafana dashboard used by GitOps from one reproducible source."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dashboards" / "comicrent-operations.json"
PROM = {"type": "prometheus", "uid": "prometheus"}


def grid(x: int, y: int, w: int, h: int) -> dict:
    return {"x": x, "y": y, "w": w, "h": h}


def target(expr: str, legend: str, ref: str = "A") -> dict:
    return {"expr": expr, "legendFormat": legend, "refId": ref}


def stat(
    ident: int,
    title: str,
    subtitle: str,
    expr: str,
    x: int,
    y: int,
    *,
    unit: str = "percentunit",
    decimals: int = 2,
    thresholds: list[tuple[float | None, str]] | None = None,
) -> dict:
    steps = thresholds or [(None, "green")]
    return {
        "id": ident,
        "type": "stat",
        "title": title,
        "description": subtitle,
        "datasource": PROM,
        "gridPos": grid(x, y, 6, 5),
        "fieldConfig": {
            "defaults": {
                "unit": unit,
                "decimals": decimals,
                "color": {"mode": "thresholds"},
                "thresholds": {
                    "mode": "absolute",
                    "steps": [{"value": value, "color": color} for value, color in steps],
                },
            },
            "overrides": [],
        },
        "options": {
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "orientation": "auto",
            "textMode": "value",
            "colorMode": "background",
            "graphMode": "area",
            "justifyMode": "center",
        },
        "targets": [{**target(expr, title), "instant": True, "range": False}],
    }


def series(
    ident: int,
    title: str,
    description: str,
    expr: str,
    x: int,
    y: int,
    *,
    unit: str,
    legend: str = "{{service}}",
    red: bool = False,
) -> dict:
    defaults: dict = {
        "unit": unit,
        "color": {"mode": "fixed", "fixedColor": "red"} if red else {"mode": "palette-classic"},
        "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "lineWidth": 2,
            "fillOpacity": 18,
            "gradientMode": "opacity",
            "showPoints": "never",
            "spanNulls": True,
        },
    }
    if unit == "percentunit":
        defaults.update({"min": 0, "max": 1})
    return {
        "id": ident,
        "type": "timeseries",
        "title": title,
        "description": description,
        "datasource": PROM,
        "gridPos": grid(x, y, 12, 8),
        "fieldConfig": {"defaults": defaults, "overrides": []},
        "options": {
            "legend": {"displayMode": "table", "placement": "bottom", "calcs": ["lastNotNull"]},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "targets": [target(expr, legend)],
    }


dashboard = {
    "id": None,
    "uid": "comicrent-p10-operations",
    "title": "ComicRent | Centro de operaciones",
    "tags": ["comicrent", "p10", "sre", "gitops"],
    "timezone": "browser",
    "schemaVersion": 39,
    "version": 2,
    "refresh": "30s",
    "time": {"from": "now-6h", "to": "now"},
    "annotations": {
        "list": [{
            "builtIn": 1,
            "datasource": {"type": "grafana", "uid": "-- Grafana --"},
            "enable": True,
            "hide": True,
            "iconColor": "rgba(74, 222, 128, 1)",
            "name": "Annotations & Alerts",
            "type": "dashboard",
        }],
    },
    "templating": {"list": []},
    "links": [],
    "liveNow": False,
    "panels": [],
}

panels = dashboard["panels"]
panels.append({
    "id": 1,
    "type": "text",
    "title": "",
    "transparent": True,
    "gridPos": grid(0, 0, 24, 3),
    "options": {
        "mode": "markdown",
        "content": "# ◈ ComicRent · Centro de operaciones\n**PRODUCCIÓN · P10** &nbsp; | &nbsp; Experiencia del usuario, salud del canary y presupuesto de error. Las sondas controladas se excluyen del SLO de usuario.",
    },
})

panels.extend([
    stat(2, "Disponibilidad", "SLO de usuario: 99.9% de solicitudes sin 5xx/timeout en 30 días.", "comicrent:slo:availability:good_ratio_30d", 0, 3, decimals=3, thresholds=[(None, "red"), (0.999, "green")]),
    stat(3, "Latencia ≤500 ms", "SLO de usuario: 95% de solicitudes en 500 ms o menos.", "comicrent:slo:latency:good_ratio_30d", 6, 3, thresholds=[(None, "red"), (0.95, "green")]),
    stat(4, "Budget · errores", "Porcentaje del presupuesto mensual de errores ya consumido.", "comicrent:slo:availability:budget_consumed_ratio_30d", 12, 3, thresholds=[(None, "green"), (0.5, "orange"), (1, "red")]),
    stat(5, "Budget · lentitud", "Porcentaje del presupuesto mensual de respuestas lentas ya consumido.", "comicrent:slo:latency:budget_consumed_ratio_30d", 18, 3, thresholds=[(None, "green"), (0.5, "orange"), (1, "red")]),
])

panels.extend([
    series(6, "01 · Tráfico", "Solicitudes por segundo; ¿está entrando tráfico y a qué servicio?", 'sum by (service) (rate(comicrent_http_requests_total{namespace="sa-p9"}[5m]))', 0, 8, unit="reqps"),
    series(7, "02 · Latencia p95", "Percentil 95 por servicio; el objetivo interactivo es 500 ms.", 'histogram_quantile(0.95, sum by (le, service) (rate(comicrent_http_request_duration_seconds_bucket{namespace="sa-p9"}[5m])))', 12, 8, unit="s"),
    series(8, "03 · Errores 5xx", "Proporción de respuestas 5xx; incluye la revisión candidata para diagnosticar despliegues.", 'sum by (service) (rate(comicrent_http_requests_total{namespace="sa-p9",status_class="5xx"}[5m])) / clamp_min(sum by (service) (rate(comicrent_http_requests_total{namespace="sa-p9"}[5m])), 0.001)', 0, 16, unit="percentunit", red=True),
    series(9, "04 · Saturación CPU", "Uso frente a CPU solicitada, agregado por contenedor.", '100 * sum by (container) (rate(container_cpu_usage_seconds_total{namespace="sa-p9",container!="",container!="POD"}[5m])) / clamp_min(sum by (container) (kube_pod_container_resource_requests{namespace="sa-p9",resource="cpu"}), 0.001)', 12, 16, unit="percent"),
    series(10, "04 · Saturación memoria", "Memoria de trabajo frente a memoria solicitada, agregada por contenedor.", '100 * sum by (container) (container_memory_working_set_bytes{namespace="sa-p9",container!="",container!="POD"}) / clamp_min(sum by (container) (kube_pod_container_resource_requests{namespace="sa-p9",resource="memory"}), 1)', 0, 24, unit="percent"),
    series(11, "Canary · tráfico de prueba", "Sondas explícitamente marcadas; ayudan a validar el candidato sin contaminar el SLO de usuario.", 'sum(rate(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="canary-test"}[5m])) or vector(0)', 12, 24, unit="reqps", legend="Sondas canary"),
])

panels.append({
    "id": 12,
    "type": "text",
    "title": "",
    "transparent": True,
    "gridPos": grid(0, 32, 24, 2),
    "options": {"mode": "markdown", "content": "## Actividad de negocio\nRentas completadas en las últimas 24 horas. Un cero significa ausencia de operaciones; un panel vacío requiere revisar la telemetría."},
})
panels.extend([
    stat(13, "Rentas creadas · 24 h", "Operaciones completadas de creación.", 'sum(increase(comicrent_rentals_created_total{namespace="sa-p9"}[24h])) or vector(0)', 0, 34, unit="short", decimals=0),
    stat(14, "Rentas devueltas · 24 h", "Operaciones completadas de devolución.", 'sum(increase(comicrent_rentals_returned_total{namespace="sa-p9"}[24h])) or vector(0)', 6, 34, unit="short", decimals=0),
])
panels[-2]["gridPos"]["w"] = 12
panels[-1]["gridPos"]["w"] = 12
panels[-1]["gridPos"]["x"] = 12

OUTPUT.write_text(json.dumps(dashboard, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(OUTPUT)
