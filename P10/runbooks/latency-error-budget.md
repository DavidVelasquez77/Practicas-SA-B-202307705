# Runbook: consumo del presupuesto de latencia

Aplica a `ComicRentLatencyBudgetFastBurn` y `ComicRentLatencyBudgetSlowBurn`.

1. Abre el tablero `ComicRent — Operación` y confirma el p95 del `api-gateway` y el tráfico reciente. La SLO considera lenta una solicitud que excede 500 ms.
2. En Prometheus consulta el histograma por ruta y servicio para distinguir un problema general de una operación específica. Revisa también CPU y memoria frente a sus solicitudes para detectar saturación.
3. Para una solicitud lenta, copia `trace_id` desde el registro JSON y abre la traza en Tempo. Identifica el span que concentra la espera; busca el mismo identificador en Loki para ver el contexto del servicio.
4. Revisa cambios recientes y dependencias. Si una versión candidata está causando la degradación, evita promoverla; el AnalysisTemplate de Argo Rollouts debe impedir la promoción cuando el p95 exceda el límite.
5. Verifica que p95 y burn rate vuelvan bajo sus límites, que el Rollout esté saludable y registra la causa y mitigación con enlaces a la traza y los registros.

La alerta rápida requiere atención inmediata porque el presupuesto de solicitudes lentas se consume a más de 14.4 veces el ritmo permitido. La alerta lenta requiere investigación en el turno y una decisión de detener promociones o priorizar la corrección.
