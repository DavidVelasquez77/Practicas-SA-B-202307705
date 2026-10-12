# Evidencia del bloque 7: canary, alerta y diagnóstico

Prueba realizada el 12 de octubre de 2026 contra el clúster GKE de P9/P10. Las llamadas se enviaron directamente al Pod candidato mediante un `port-forward`; el servicio estable no recibió la configuración defectuosa ni las llamadas de prueba.

## Promoción sana previa

Se corrigieron las URLs del gateway en el overlay P10 para usar los nombres reales de los servicios del release `comicrent-p9-workloads`. Antes de inducir el fallo, el Rollout `comicrent-api-gateway-rollout` llegó a `Healthy`, paso `10/10`, hash estable `bf669688c`, con `3/3` réplicas disponibles. Se enviaron 40 solicitudes de login con credenciales ficticias inválidas: todas respondieron `401`, ninguna `5xx`; el p95 medido por el gateway fue `70 ms`.

El AnalysisTemplate ahora calcula volumen, tasa de error y p95 sobre una ventana reciente de cinco minutos. Exige al menos 20 solicitudes antes de decidir. Esta muestra mínima evita que una única solicitud fría determine el p95 de todo el candidato.

## Fallo inducido y reversión automática

El commit temporal de GitOps `7540a4b` cambió únicamente la URL de autenticación del candidato a `http://auth-backend.p10.invalid:3001` y amplió temporalmente la espera del análisis para permitir que se materializara la alerta de dos minutos. La rama se restauró al terminar la prueba mediante el commit `60a2cc0`; el endpoint válido volvió a ser `http://comicrent-p9-workloads-auth-service:3001` y la espera quedó en 90 segundos.

La primera tanda empezó a `2026-10-12T23:01:38.176Z`. En dos tandas se enviaron 80 solicitudes al candidato; las 80 respondieron `502`. Ninguna llamada modificó datos: se usó la ruta de login con un correo ficticio reservado.

| Señal | Resultado observado |
|---|---|
| Hash candidato | `b544dbdd9` |
| Hash estable antes y después | `bf669688c` |
| AnalysisRun | `comicrent-api-gateway-rollout-b544dbdd9-9-1` |
| Inicio y fin del análisis | `23:00:59Z` → `23:04:29Z` |
| Volumen candidato en la ventana | `44.03` solicitudes observadas por Prometheus |
| Tasa de error candidata | `1.0` (100%; el límite es `0.001`) |
| p95 candidato | `0.0487 s` (48.7 ms) |
| Decisión | `Failed` por `candidate-error-ratio`; Argo Rollouts abortó sin intervención |
| Estado posterior | Rollout `Healthy`, paso `10/10`, hash estable `bf669688c`, `3/3` réplicas |

El servicio estable conservó el hash `bf669688c` durante el fallo. Tras el aborto, los servicios estable y canary volvieron a seleccionar ese mismo hash. El p95 permaneció bajo el límite; la promoción se detuvo por la tasa de errores real del candidato.

## Recorrido de alerta a causa

Prometheus activó `ComicRentAvailabilityBudgetFastBurn`, la alerta por consumo rápido del presupuesto de disponibilidad. Su estado pasó a `pending` a `2026-10-12T23:03:22.384Z`; la regla exige `for: 2m`. Al consultarla, estaba `firing`, con burn rate de disponibilidad de hasta `1000x`. La consulta PromQL agrupada por ruta señaló `/api/auth/login` como el origen de los `5xx`.

Desde Loki se consultó el registro estructurado por su `correlation_id`. La entrada de error fue:

```json
{"timestamp":"2026-10-12T23:01:39.044Z","level":"ERROR","service":"api-gateway","event":"http.request.failed","trace_id":"a3f84aa1985dc03f443808ff9036e098","span_id":"d71387692456e950","correlation_id":"p10-block7-fault-20261012T230138Z-1","method":"POST","route":"/api/auth/login","status_code":502,"error_type":"BadGatewayException"}
```

Con ese `trace_id` se abrió la traza en Tempo. El span servidor confirmó HTTP `502`; el span cliente mostró la llamada a `http://auth-backend.p10.invalid:3001/auth/login` y el error DNS `ENOTFOUND`. La causa fue la URL de dependencia inválida declarada en la revisión candidata.

La alerta ya estaba `firing` antes de iniciar la consulta de Loki y Tempo. La consulta conjunta de alerta, métrica por ruta, registro JSON y traza terminó en `4.6 s`. Usando el primer instante posible de `firing` (`pendingAt + for` = `23:05:22.384Z`) y el fin de diagnóstico `23:06:39.310Z`, el recorrido alerta-a-causa fue como máximo `76.93 s`, debajo del objetivo de tres minutos.

## Recuperación y estado final

El cambio de prueba se revirtió en GitOps; ArgoCD quedó `Synced/Healthy` con la URL válida. El Rollout quedó `Healthy` al 100% y una solicitud nueva de login respondió `401` esperado, en lugar de `502`. Después de la prueba no había alertas de quema rápida activas; la ventana rápida dejó de cumplir su condición mientras la ventana de una hora todavía reflejaba el error inducido.

Los archivos adjuntos conservan el resultado aunque el clúster elimine recursos antiguos según su política de retención:

- [AnalysisRun del aborto](./block-7-analysisrun.json)
- [Registro JSON consultado desde Loki](./block-7-loki-log.json)
- [Spans consultados desde Tempo](./block-7-tempo-spans.json)
- [Resumen de señales y tiempos](./block-7-signal-summary.json)
