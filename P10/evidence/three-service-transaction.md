# Transacción instrumentada entre tres servicios

El 13 de octubre de 2026 a las 03:28:57 UTC se creó una renta de prueba para el cómic `P10 Trazabilidad Demo`. La respuesta GraphQL confirmó `createRental.id=2`, `comicId=1`, `copyId=1` y estado `ACTIVO`. El encabezado `X-Correlation-ID: p10-three-service-verified-20261012` aparece en el registro JSON de `rentals-service` con `trace_id=3986f644ad15855fbac4b5dfbc9f459b`.

La [traza exportada de Tempo](three-service-trace.json) contiene **14 spans** de una sola solicitud: 7 de `rentals-service`, 1 de `comics-service` y 6 de `copies-service`. Incluye las llamadas HTTP de Rentals a la consulta GraphQL de Comics y a la búsqueda/reserva del ejemplar en Copies. El mismo `trace_id` permite pasar del log a Tempo.

En Prometheus, los [contadores exportados](business-metrics-live.json) muestran `comicrent_rentals_created_total=2` y `comicrent_rentals_returned_total=1` en el Pod que procesó las operaciones. El tablero agrega los Pods y presenta **2 rentas creadas** y **1 devuelta** en 24 horas. La segunda devolución respondió `DEVUELTO` y el consumidor confirmó después el ejemplar como `DISPONIBLE`.

La primera devolución ocurrió mientras RabbitMQ se reiniciaba: la renta se marcó `DEVUELTO`, pero la publicación del evento falló. Se compensó el ejemplar de prueba mediante el endpoint de Copies antes de repetir la transacción. Este hecho revela una limitación de la operación: el cambio de estado y la publicación del evento no son atómicos. No se cuenta esa primera devolución como exitosa en la métrica de negocio.
