"""Build the Grafana dashboard used by GitOps from one reproducible source."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "dashboards" / "comicrent-operations.json"
PROM = {"type": "prometheus", "uid": "prometheus"}

# Mantener una identidad por señal sin pintar todos los servicios igual.
SERVICE_COLORS = {
    6: {"api-gateway": "#0EA5E9", "auth-service": "#2563EB", "comics-service": "#38BDF8", "copies-service": "#6366F1", "rentals-service": "#22D3EE"},
    7: {"api-gateway": "#FBBF24", "auth-service": "#F97316", "comics-service": "#FDE047", "copies-service": "#FB923C", "rentals-service": "#D97706"},
    8: {"api-gateway": "#FB7185", "auth-service": "#EF4444", "comics-service": "#F43F5E", "copies-service": "#BE123C", "rentals-service": "#FDA4AF"},
    9: {"api-gateway": "#A78BFA", "auth-service": "#7C3AED", "comics-service": "#C4B5FD", "copies-service": "#8B5CF6", "rentals-service": "#D8B4FE"},
    10: {"api-gateway": "#2DD4BF", "auth-service": "#10B981", "comics-service": "#5EEAD4", "copies-service": "#14B8A6", "rentals-service": "#34D399"},
}


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
    color: str = "#38BDF8",
    width: int = 6,
    height: int = 5,
) -> dict:
    steps = thresholds or [(None, color)]
    return {
        "id": ident,
        "type": "stat",
        "title": title,
        "description": subtitle,
        "datasource": PROM,
        "gridPos": grid(x, y, width, height),
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
    color: str = "#38BDF8",
    fill: int = 22,
) -> dict:
    defaults: dict = {
        "unit": unit,
        "color": {"mode": "fixed", "fixedColor": color} if legend == "Sondas canary" else {"mode": "palette-classic"},
        "custom": {
            "drawStyle": "line",
            "lineInterpolation": "smooth",
            "lineWidth": 3,
            "fillOpacity": fill,
            "gradientMode": "opacity",
            "showPoints": "auto",
            "spanNulls": True,
        },
    }
    if unit == "percentunit":
        defaults.update({"min": 0, "max": 1})
    overrides = [
        {"matcher": {"id": "byName", "options": name}, "properties": [{"id": "color", "value": {"mode": "fixed", "fixedColor": shade}}]}
        for name, shade in SERVICE_COLORS.get(ident, {}).items()
    ]
    return {
        "id": ident,
        "type": "timeseries",
        "title": title,
        "description": description,
        "datasource": PROM,
        "gridPos": grid(x, y, 12, 8),
        "fieldConfig": {"defaults": defaults, "overrides": overrides},
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
    "version": 3,
    "refresh": "30s",
    "time": {"from": "now-7d", "to": "now"},
    "annotations": {
        "list": [{
            "builtIn": 1,
            "datasource": {"type": "grafana", "uid": "-- Grafana --"},
            "enable": True,
            "hide": True,
            "iconColor": "rgba(168, 85, 247, 1)",
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
    "gridPos": grid(0, 0, 24, 4),
    "options": {
        "mode": "markdown",
        "content": "# ◈ ComicRent · Centro de operaciones\n**P10 · GKE / GitOps** &nbsp; · &nbsp; Las sondas Canary se excluyen del SLO de usuario.\n\n> **30 d = objetivo a largo plazo, historial aún incompleto.** La fila de 24 h muestra mediciones disponibles para la calificación.",
    },
})

panels.extend([
    stat(2, "Disponibilidad · 30 d*", "Objetivo ≥99.9%; historial aún incompleto.", "comicrent:slo:availability:good_ratio_30d", 0, 4, decimals=3, thresholds=[(None, "#FB7185"), (0.999, "#34D399")]),
    stat(3, "Respuesta ≤500 ms · 30 d*", "Objetivo ≥95%; historial aún incompleto.", "comicrent:slo:latency:good_ratio_30d", 6, 4, thresholds=[(None, "#F97316"), (0.95, "#22D3EE")]),
    stat(4, "Budget · errores*", "Presupuesto de disponibilidad consumido sobre datos observados.", "comicrent:slo:availability:budget_consumed_ratio_30d", 12, 4, thresholds=[(None, "#818CF8"), (0.5, "#FBBF24"), (1, "#F43F5E")]),
    stat(5, "Budget · lentitud*", "Presupuesto de latencia consumido sobre datos observados.", "comicrent:slo:latency:budget_consumed_ratio_30d", 18, 4, thresholds=[(None, "#A78BFA"), (0.5, "#FB923C"), (1, "#EF4444")]),
])

panels.append({
    "id": 15, "type": "text", "title": "", "transparent": True,
    "gridPos": grid(0, 9, 24, 3),
    "options": {"mode": "markdown", "content": "## Evidencia reciente · últimas 24 horas\nSolicitudes de usuario, disponibilidad, rapidez e historial disponible. **La ventana corta no sustituye el SLO de 30 días.** Sin solicitudes, un porcentaje debe quedar sin dato."},
})
panels.extend([
    stat(16, "Solicitudes de usuario · 24 h", "Volumen observado, excluye sondas Canary.", 'sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user"}[24h])) or vector(0)', 0, 12, unit="short", decimals=0, color="#38BDF8"),
    stat(17, "Disponibilidad · 24 h", "Solicitudes sin 5xx/timeout durante el último día.", '1 - ((sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user",status_class=~"5xx|timeout"}[24h])) or vector(0)) / sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user"}[24h])))', 6, 12, color="#2DD4BF", decimals=3),
    stat(18, "Respuesta ≤500 ms · 24 h", "Proporción de respuestas ágiles del último día.", 'sum(increase(comicrent_http_request_duration_seconds_bucket{namespace="sa-p9",service="api-gateway",traffic_source="user",le="0.5"}[24h])) / sum(increase(comicrent_http_request_duration_seconds_count{namespace="sa-p9",service="api-gateway",traffic_source="user"}[24h]))', 12, 12, color="#FBBF24"),
    stat(19, "Edad del primer dato", "Tiempo desde la primera muestra disponible; no prueba continuidad si el clúster estuvo apagado.", '(time() - min(min_over_time(timestamp(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user"})[30d:1h]))) / 86400', 18, 12, unit="d", decimals=1, color="#C084FC"),
])

panels.extend([
    series(6, "01 · Tráfico", "Solicitudes por segundo; ¿está entrando tráfico y a qué servicio?", 'sum by (service) (rate(comicrent_http_requests_total{namespace="sa-p9"}[5m]))', 0, 17, unit="reqps", color="#38BDF8", fill=26),
    series(7, "02 · Latencia p95", "Percentil 95 por servicio; el objetivo interactivo es 500 ms.", 'histogram_quantile(0.95, sum by (le, service) (rate(comicrent_http_request_duration_seconds_bucket{namespace="sa-p9"}[5m])))', 12, 17, unit="s", color="#FBBF24", fill=20),
    series(8, "03 · Errores 5xx", "Proporción de respuestas 5xx; muestra 0% cuando hay tráfico del servicio pero no errores.", '(sum by (service) (rate(comicrent_http_requests_total{namespace="sa-p9",status_class="5xx"}[5m])) or on (service) (0 * sum by (service) (rate(comicrent_http_requests_total{namespace="sa-p9"}[5m])))) / clamp_min(sum by (service) (rate(comicrent_http_requests_total{namespace="sa-p9"}[5m])), 0.001)', 0, 25, unit="percentunit", color="#FB7185", fill=30),
    series(9, "04 · Saturación CPU", "Uso frente a CPU solicitada, agregado por contenedor.", '100 * sum by (container) (rate(container_cpu_usage_seconds_total{namespace="sa-p9",container!="",container!="POD"}[5m])) / clamp_min(sum by (container) (kube_pod_container_resource_requests{namespace="sa-p9",resource="cpu"}), 0.001)', 12, 25, unit="percent", color="#A78BFA", fill=18),
    series(10, "04 · Saturación memoria", "Memoria de trabajo frente a memoria solicitada, agregada por contenedor.", '100 * sum by (container) (container_memory_working_set_bytes{namespace="sa-p9",container!="",container!="POD"}) / clamp_min(sum by (container) (kube_pod_container_resource_requests{namespace="sa-p9",resource="memory"}), 1)', 0, 33, unit="percent", color="#2DD4BF", fill=22),
    series(11, "Canary · tráfico de prueba", "Sondas explícitamente marcadas; ayudan a validar el candidato sin contaminar el SLO de usuario.", 'sum(rate(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="canary-test"}[5m])) or vector(0)', 12, 33, unit="reqps", legend="Sondas canary", color="#FB923C", fill=32),
])

panels.append({
    "id": 12,
    "type": "text",
    "title": "",
    "transparent": True,
    "gridPos": grid(0, 41, 24, 3),
    "options": {"mode": "markdown", "content": "## Actividad de negocio · últimos 7 días\nRentas creadas y devueltas en la última semana. Cero = sin operaciones; panel vacío = revisar telemetría."},
})
panels.extend([
    stat(13, "Rentas creadas · 7 d", "Operaciones completadas de creación en los últimos 7 días.", 'sum(increase(comicrent_rentals_created_total{namespace="sa-p9"}[7d])) or vector(0)', 0, 44, unit="short", decimals=0, color="#60A5FA", width=12),
    stat(14, "Rentas devueltas · 7 d", "Operaciones completadas de devolución en los últimos 7 días.", 'sum(increase(comicrent_rentals_returned_total{namespace="sa-p9"}[7d])) or vector(0)', 12, 44, unit="short", decimals=0, color="#34D399", width=12),
])

OUTPUT.write_text(json.dumps(dashboard, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(OUTPUT)
