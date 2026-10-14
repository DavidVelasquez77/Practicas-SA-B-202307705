# SLO de ComicRent

Los objetivos se miden en el `api-gateway`, el punto de entrada que representa la experiencia HTTP del usuario. Las rutas `/health` y `/metrics` no cuentan como solicitudes de usuario. Las sondas controladas del canary llevan `X-ComicRent-Observability-Probe: canary` y reciben la etiqueta de cardinalidad fija `traffic_source="canary-test"`; tanto el SLO como el AnalysisTemplate P10 usan solo `traffic_source="user"` para evaluar el comportamiento de la revisión candidata.

| SLO | Indicador y objetivo | Ventana | Presupuesto |
|---|---|---|---|
| Disponibilidad | Al menos 99.9% de las solicitudes terminan sin respuesta 5xx ni timeout. | 30 días móviles | 0.1% de solicitudes fallidas; equivale a 43.2 minutos de indisponibilidad si se expresa como tiempo uniforme durante 30 días. |
| Latencia | Al menos 95% de las solicitudes terminan en 500 ms o menos. | 30 días móviles | 5% de solicitudes lentas. |

El 99.9% limita el impacto de fallos sin prometer disponibilidad absoluta para un sistema académico con dependencias compartidas. El umbral de 500 ms mantiene la respuesta interactiva y coincide con el límite que gobierna el canary. Los indicadores se calculan con contadores e histogramas HTTP instrumentados, no con CPU ni con pruebas sintéticas.

## Indicadores y consultas

Las reglas desplegadas están en `apps/p10/observability/rules/slo-rules.yaml` del repositorio GitOps. Disponibilidad considera como eventos malos las clases `5xx` y `timeout`; las respuestas 4xx se cuentan como respuestas servidas. Latencia considera malo cada evento que excede 500 ms.

```promql
# SLI de disponibilidad: solicitudes buenas / solicitudes totales, ventana de 30 días
1 - (
  (sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user",status_class=~"5xx|timeout"}[30d])) or vector(0))
  /
  sum(increase(comicrent_http_requests_total{namespace="sa-p9",service="api-gateway",traffic_source="user"}[30d]))
)

# SLI de latencia: solicitudes <= 500 ms / solicitudes totales, ventana de 30 días
sum(increase(comicrent_http_request_duration_seconds_bucket{namespace="sa-p9",service="api-gateway",traffic_source="user",le="0.5"}[30d]))
/
sum(increase(comicrent_http_request_duration_seconds_count{namespace="sa-p9",service="api-gateway",traffic_source="user"}[30d]))
```

El presupuesto consumido es eventos malos dividido entre eventos permitidos en la misma ventana: solicitudes fallidas / (solicitudes totales × 0.001) para disponibilidad y solicitudes lentas / (solicitudes totales × 0.05) para latencia. Un resultado de `1` significa que se consumió el 100% del presupuesto; valores mayores indican que se excedió.

## Política de alertas

Las reglas usan tasas de consumo del presupuesto con ventanas múltiples; no alertan por un pico aislado ni por un umbral instantáneo de latencia o errores.

| Prioridad | Condición sostenida | Acción |
|---|---|---|
| Crítica, quema rápida | Burn rate mayor a 14.4× en 5 minutos y 1 hora; `for: 2m`. Consume aproximadamente 2% del presupuesto mensual en una hora. | Atender de inmediato; seguir el runbook del SLO y mitigar el cambio o dependencia que provoca el impacto. |
| Advertencia, quema lenta | Burn rate mayor a 6× en 30 minutos y 6 horas; `for: 5m`. Consume aproximadamente 5% del presupuesto mensual en seis horas. | Investigar en el turno operativo y evitar promociones mientras persista el consumo. |

Cada alerta lleva la URL del runbook correspondiente. Prometheus retiene 31 días con un volumen de 40 GiB y un límite de 36 GB de datos; el espacio debe vigilarse para evitar que el límite de tamaño reduzca la ventana antes de 30 días. Durante los primeros 30 días desde la nueva instrumentación, la ventana aún no contiene un mes completo y no debe presentarse como una medición histórica completa.

## Cómo interpretar el tablero antes de completar 30 días

El horizonte de los SLO sigue siendo de 30 días móviles. El tablero añade una vista observada de 24 horas para poder revisar tráfico reciente, disponibilidad, latencia y presupuesto antes de que exista un mes completo de telemetría. La edad de la primera muestra indica desde cuándo hay datos, pero no demuestra continuidad si el clúster estuvo apagado; para intervalos sin muestras se debe revisar la serie temporal o `up`.

La vista de 24 horas es una comprobación operativa corta, no un tercer SLO ni una simulación de historia. Si no hay solicitudes en la ventana, el indicador debe quedar sin dato y el volumen debe mostrar cero; nunca se debe interpretar como 100% de cumplimiento. Al presentar porcentajes con poco tráfico, también se informa el denominador.
