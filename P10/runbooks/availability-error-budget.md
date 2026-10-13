# Runbook: consumo del presupuesto de disponibilidad

Aplica a `ComicRentAvailabilityBudgetFastBurn` y `ComicRentAvailabilityBudgetSlowBurn`.

1. Abre el tablero `ComicRent | Centro de operaciones` y confirma que el panel de errores muestra actividad reciente. La regla cuenta respuestas 5xx y solicitudes interrumpidas con `status_class="timeout"` en el `api-gateway`, solo para `traffic_source="user"`.
2. En Prometheus compara los eventos malos por ruta con el total de solicitudes. Confirma si el consumo afecta una ruta o todas.
3. Desde un registro JSON afectado copia `trace_id`; abre la traza en Tempo y sigue los spans para ubicar el servicio o dependencia que originó el error. Consulta en Loki los registros con ese mismo `trace_id`.
4. Revisa el último cambio desplegado y la salud de los servicios y dependencias. Si coincide con una versión defectuosa, detén la promoción y usa el mecanismo de reversión de Argo Rollouts/GitOps definido para el despliegue.
5. Comprueba que los errores disminuyan, que el Rollout y las aplicaciones estén saludables y que el burn rate vuelva bajo el umbral. Registra la causa, mitigación y enlaces a la traza y los registros.

La alerta rápida requiere atención inmediata porque a ese ritmo consume aproximadamente 2% del presupuesto de 30 días en una hora. La alerta lenta requiere investigación durante el turno porque consume aproximadamente 5% en seis horas y, si continúa, agota el margen disponible.

**Límite del indicador:** las conexiones que fallan antes de llegar al gateway no incrementan `comicrent_http_requests_total`. En la prueba de promoción por el Service público hubo dos `URLError` del cliente durante la transición; se conservaron en la [evidencia del Canary](../evidence/public-canary-traffic.md). Ante reportes de conexión sin 5xx internos, verifica la IP pública y los endpoints del Service y añade una sonda externa de disponibilidad; no concluyas que el 100% del panel implica ausencia de fallos de red.
