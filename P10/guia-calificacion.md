# Guía de calificación — Práctica 10

Esta guía sigue el **Detalle de la Calificación, sección 8.2**, del enunciado. Trabajar desde `C:\Users\Vela\Desktop\SA\LAB\PRACTICAS`. La evidencia histórica permite revisar el simulacro sin repetir una falla frente al auxiliar. El video se añadirá al final de la entrega.

## Comprobación inicial (requisitos de 8.1)

```powershell
kubectl config current-context
kubectl get applications -n argocd
kubectl get pods -n observability
kubectl get prometheusrule comicrent-slo-rules -n observability
kubectl get analysistemplate api-gateway-metrics -n sa-p9 -o yaml
& (Join-Path $HOME 'bin/kubectl-argo-rollouts.exe') get rollout comicrent-api-gateway-rollout -n sa-p9
```

Las aplicaciones deben estar `Synced/Healthy`, Prometheus y Grafana `Running`, el AnalysisTemplate debe contener `provider.prometheus` y el Rollout debe estar `Healthy`. Si el clúster estuvo apagado, verificar antes de presentar; las capturas no prueban que esté operativo **en ese momento**. La tabla 4.1 y las rutas públicas están en [README.md](README.md). La fila del video sigue pendiente de un enlace directo y minutaje real.

| Criterio | Mostrar primero | Si pide ejecutar algo |
|---|---|---|
| **1.1 — SLO (10 pts)** | [SLOs.md](slo/SLOs.md): disponibilidad ≥99.9% y respuestas ≤500 ms en ≥95%, ambos a 30 días; justificación y presupuestos. [Tablero](evidence/grafana-dashboard-fault-24h.jpg) con cálculo reciente y edad del primer dato. | `kubectl get prometheusrule comicrent-slo-rules -n observability -o yaml`; comprobar reglas `comicrent:slo:*`. Explicar que el 30d aún es parcial y la evidencia de 24 h no sustituye al objetivo mensual. |
| **1.2 — Tablero (8 pts)** | [JSON exportado](dashboards/comicrent-operations.json), [SLO/presupuesto](evidence/grafana-dashboard-final-slo.jpg), [señales de oro](evidence/grafana-dashboard-final-golden-signals.jpg), [24 h](evidence/grafana-dashboard-fault-24h.jpg) y [negocio](evidence/grafana-dashboard-business-live.png). Orden: tráfico, latencia, errores y saturación; luego rentas y presupuesto. | Abrir Grafana mediante `kubectl port-forward -n observability svc/p10-observability-grafana 33000:80` y visitar `http://127.0.0.1:33000/d/comicrent-p10-operations`. Mantener esa terminal abierta. |
| **1.3 — Informe (12 pts)** | [PDF de una página](informe-operacion.pdf): los seis campos, marcas UTC, tiempo real y mejora concreta. | Abrir [fuente](informe-operacion.md) si pide los enlaces de AnalysisRun, Loki y Tempo. El informe mide el incidente del 12/oct; la prueba pública posterior está documentada aparte. |
| **1.4 — Teoría (10 pts)** | Explicar que un `401` con credenciales ficticias cuenta como petición atendida; un `502` del candidato no. El SLO usa HTTP percibido por usuario y excluye las sondas. | Señalar la limitación: con tres réplicas Basic Canary aproxima 10/25/50%, no fija exactamente cada porcentaje; un error de conexión anterior al gateway no entra en su contador. |
| **2.1 — Tres pilares (14 pts)** | [Transacción de tres servicios](evidence/three-service-transaction.md), [traza](evidence/three-service-trace.json), [log JSON correlacionado](evidence/block-7-loki-log.json), [métricas de rentas](evidence/business-metrics-live.json). | Mostrar `trace_id` común en spans y registro; abrir código de instrumentación enlazado en el README. |
| **2.2 — Canary por métricas (16 pts)** | [Prueba sana y fallo por Service público](evidence/public-canary-traffic.md), [AnalysisRun fallido](evidence/public-canary-abort-analysisrun.json), [Rollout recuperado](evidence/public-canary-recovered-rollout.json). Cuatro AnalysisRuns sanos en [prueba de promoción](evidence/public-canary-proof.json). | `kubectl get analysistemplate api-gateway-metrics -n sa-p9 -o yaml` y `& (Join-Path $HOME 'bin/kubectl-argo-rollouts.exe') get rollout comicrent-api-gateway-rollout -n sa-p9` en PowerShell. Prometheus evalúa volumen, error 5xx y p95 del **hash candidato** con `traffic_source="user"`; no hay Job sintético en el AnalysisTemplate P10. |
| **2.3 — Presupuestos/alertas (12 pts)** | [SLOs](slo/SLOs.md), [alertas disparadas](evidence/prometheus-slo-alerts-firing.jpg), [enlace a runbook](evidence/prometheus-slo-alert-runbook.jpg), [runbook de disponibilidad](runbooks/availability-error-budget.md) y [latencia](runbooks/latency-error-budget.md). | `kubectl get prometheusrule comicrent-slo-rules -n observability -o yaml`. Las alertas son de consumo rápido/lento del presupuesto; al simular falla la ventana móvil conserva el gasto incluso tras recuperar el servicio. |
| **2.4 — Síntoma a causa (10 pts)** | [Cronología medida de alerta → Prometheus → Loki → Tempo](evidence/block-7-canary-and-triage.md) y [marcas originales](evidence/block-7-signal-summary.json). Resultado ≤1 min 16.93 s desde posible `firing` hasta causa, bajo el límite de 3 min. | Seguir el `trace_id` del log a [spans Tempo](evidence/block-7-tempo-spans.json). Decir con precisión que esa medición fue del primer incidente, directo al Pod; el segundo simulacro confirmó por separado el enrutamiento público y aborto por métricas. |
| **2.5 — Logs estructurados (8 pts)** | [Registro Loki JSON](evidence/block-7-loki-log.json): `trace_id`, ruta, estado 502 y campos consultables; [traza relacionada](evidence/block-7-tempo-spans.json). | En Grafana Explore filtrar por el `trace_id` de la evidencia y abrir el span correspondiente de Tempo. |

## Tres comprobaciones rápidas si el tiempo es corto

1. `kubectl get applications -n argocd`: continuidad GitOps y stack activo.
2. `kubectl get analysistemplate api-gateway-metrics -n sa-p9 -o yaml`: consulta Prometheus sobre el candidato, sin Job de humo.
3. Abrir [el AnalysisRun fallido](evidence/public-canary-abort-analysisrun.json) y [la prueba de tráfico público](evidence/public-canary-traffic.md): `candidate-error-ratio` falló con tasa `1.0`, Rollout abortó y el hash estable se conservó.

La reproducción del fallo no es necesaria para demostrar lo sucedido: el commit defectuoso y su reversión están enlazados en la prueba. Si el auxiliar exige ejecutarlo de nuevo, generar tráfico y restaurar GitOps solo después de verificar que el clúster y el acceso público están sanos; no alterar el AnalysisRun histórico.
