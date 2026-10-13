# Práctica 10 — Observabilidad y operación de ComicRent

Esta práctica amplía el clúster GitOps de P9 con métricas, trazas y registros correlacionados. ArgoCD despliega Prometheus, Alertmanager, Grafana, Loki, Tempo, Alloy y OpenTelemetry Collector; Argo Rollouts consulta métricas del candidato para decidir cada promoción. El incidente medido y el informe de operación ([PDF de una página](informe-operacion.pdf), [fuente Markdown](informe-operacion.md)) documentan el comportamiento real del sistema.

## Tabla de enlaces obligatoria (sección 4.1)

| Ítem | Enlace o dato requerido |
|---|---|
| Repositorio de código | [Practicas-SA-B-202307705](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705) |
| Repositorio GitOps | [Practicas-SA-B-202307705-gitops](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops) |
| Servicios instrumentados | `api-gateway`, `rentals-service` y `copies-service` en `sa-p9`; `auth-service` también está instrumentado. [Código del gateway](../P4/api-gateway/src/observability/telemetry.ts), [rentas](../P4/services/rentals-service/app/observability.py), [copias](../P4/services/copies-service/app/observability.py). |
| Traza entre tres servicios | [Transacción verificada](evidence/three-service-transaction.md) y [traza Tempo](evidence/three-service-trace.json): `rentals-service` → `comics-service` y `copies-service`, un mismo `trace_id` en 14 spans. |
| Métricas de negocio | [`comicrent_rentals_created_total` y `comicrent_rentals_returned_total`](evidence/business-metrics-live.json), emitidas desde el arranque y aumentadas por operaciones reales de creación y devolución. |
| AnalysisTemplate por métricas | `api-gateway-metrics`, namespace `sa-p9`: [manifiesto GitOps](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/blob/feature/p10-observability/apps/comicrent/templates/p10-analysis.yaml). |
| Publicación instrumentada | [GitHub Actions v0.9.2](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/38340568756) publicó cinco imágenes con Trivy, SBOM y Cosign; el [PR GitOps #27](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/27) actualizó los tags. El [Rollout final](evidence/rollout-v0.9.2-healthy.json) quedó `Healthy` tras cuatro AnalysisRuns exitosos. |
| Consultas del análisis | [PromQL exacto para volumen, error y p95](#consultas-promql-del-canary); [plantilla GitOps](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/blob/feature/p10-observability/apps/comicrent/templates/p10-analysis.yaml). |
| SLO declarados | [Disponibilidad ≥99.9% y latencia ≥95% de solicitudes ≤500 ms, ambos en 30 días móviles](slo/SLOs.md). |
| Reglas de alerta | [`PrometheusRule comicrent-slo-rules`](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/blob/feature/p10-observability/apps/p10/observability/rules/slo-rules.yaml), con [runbook de disponibilidad](runbooks/availability-error-budget.md) y [runbook de latencia](runbooks/latency-error-budget.md). |
| Tablero | [JSON exportado de Grafana](dashboards/comicrent-operations.json), UID `comicrent-p10-operations`, [SLO y señales de oro](evidence/grafana-dashboard-live.png) y [métricas de negocio](evidence/grafana-dashboard-business-live.png). |
| Reversión por métricas | [AnalysisRun `comicrent-api-gateway-rollout-b544dbdd9-9-1` (`Failed`)](evidence/block-7-analysisrun.json) del Rollout `comicrent-api-gateway-rollout`, namespace `sa-p9`; [secuencia](evidence/block-7-canary-and-triage.md) y [estado estable recuperado](evidence/block-8-rollout-recovery.json). |
| Recorrido síntoma a causa | [Alerta → Prometheus → Loki → Tempo, máximo 1 min 16.93 s desde `firing`](evidence/block-7-canary-and-triage.md); [marcas medidas](evidence/block-7-signal-summary.json). |
| Video demostrativo | [Carpeta de Drive destinada al video](https://drive.google.com/drive/folders/1o23KFwNxf1ac2Y3ctkz1hr3OQOUZ1a3o?usp=sharing). La [guía de minutaje recomendado](#video-demostrativo) está abajo; después de grabar se agregará aquí el enlace directo al archivo y su minutaje real. |

> **Estado de entrega:** falta la URL pública directa del video con el minutaje real. La fila del video debe completarse antes de calificar; el enunciado asigna cero a enlaces ausentes o que requieran autenticación.

## Flujo de telemetría

```mermaid
flowchart LR
  GitOps[Repositorio GitOps] --> ArgoCD[ArgoCD]
  ArgoCD --> Stack[Prometheus · Grafana · Loki · Tempo · Alloy · OTel Collector]
  Services[ComicRent: gateway · rentas · copias · auth] -->|/metrics| Prometheus
  Services -->|trazas OTLP| Collector[OTel Collector] --> Tempo
  Services -->|logs JSON con trace_id| Alloy --> Loki
  Prometheus -->|SLI y burn rate| Alerts[PrometheusRule → Alertmanager → runbook]
  Prometheus -->|error y p95 candidatos| Rollouts[Argo Rollouts]
  Prometheus --> Grafana
  Loki --> Grafana
  Tempo --> Grafana
```

[Fuente editable del diagrama](diagrams/telemetry-flow.mmd). El tablero responde por orden a tráfico, latencia, errores y saturación; añade actividad de rentas y consumo de los dos presupuestos.

![Tablero Grafana de ComicRent con SLO actuales y señales de oro](evidence/grafana-dashboard-live.png)

![Actividad de negocio y sondas Canary separadas en el tablero](evidence/grafana-dashboard-business-live.png)

El tablero separa tráfico de usuarios y sondas controladas del Canary. La vista de negocio usa contadores inicializados en cero y ya se verificó con una renta creada y otra devuelta. La retención de Prometheus es de 31 días en un volumen de 40 GiB; el SLO de 30 días no debe interpretarse como historial completo hasta que transcurra esa ventana desde la nueva instrumentación.

## Consultas PromQL del canary

Las consultas están en el [AnalysisTemplate `api-gateway-metrics`](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/blob/feature/p10-observability/apps/comicrent/templates/p10-analysis.yaml). `HASH` representa el argumento `rollout-hash` de la revisión candidata. Se evalúan sobre los últimos cinco minutos y se exige volumen ≥20 para evitar una decisión basada en una sola solicitud fría.

```promql
# Volumen: se promociona únicamente con al menos 20 solicitudes recientes.
sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",rollouts_pod_template_hash="HASH"}[5m])) or vector(0)

# Errores 5xx y timeout / solicitudes del candidato: debe ser <= 0.001.
(sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",rollouts_pod_template_hash="HASH",status_class=~"5xx|timeout"}[5m])) / clamp_min(sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",rollouts_pod_template_hash="HASH"}[5m])), 1)) or vector(0)

# p95 de latencia del candidato: debe ser <= 0.5 segundos.
histogram_quantile(0.95, sum by (le) (rate(comicrent_http_request_duration_seconds_bucket{namespace="sa-p9",service="api-gateway",rollouts_pod_template_hash="HASH"}[5m]))) or vector(0)
```

El fallo de P10 fue una URL de autenticación inválida en la revisión candidata. Prometheus midió tasa de error `1.0`; el AnalysisRun falló y Argo Rollouts abortó sin intervención. La versión estable conservó sus tres réplicas. [Evidencia completa](evidence/block-7-canary-and-triage.md).

## Video demostrativo

Duración requerida: 5–8 minutos. El video se publicará en la [carpeta de Drive de P10](https://drive.google.com/drive/folders/1o23KFwNxf1ac2Y3ctkz1hr3OQOUZ1a3o?usp=sharing). Este es el recorrido recomendado de **7 min 15 s**; al grabarlo se ajustarán los minutos a la duración real y se pondrá el enlace directo al archivo en la tabla.

| Minutaje previsto | Qué mostrar |
|---|---|
| 0:00–0:45 | ArgoCD: aplicaciones GitOps de observabilidad `Synced/Healthy` y servicios instrumentados. |
| 0:45–1:45 | Prometheus: métricas de los tres servicios, dos métricas de negocio, reglas SLI y presupuestos. |
| 1:45–2:45 | Grafana: tablero con las cuatro señales de oro y SLO de 30 días. |
| 2:45–3:45 | AnalysisTemplate: volumen, error y p95 de la revisión candidata en PromQL. |
| 3:45–5:00 | AnalysisRun fallido, evento `RolloutAborted` y ReplicaSet estable. |
| 5:00–6:30 | Alerta `ComicRentAvailabilityBudgetFastBurn`, ruta afectada, registro JSON en Loki y `trace_id` en Tempo. |
| 6:30–7:15 | Informe: tiempos medidos, recuperación GitOps y separación ya implementada entre tráfico de usuario y sondas Canary. |
