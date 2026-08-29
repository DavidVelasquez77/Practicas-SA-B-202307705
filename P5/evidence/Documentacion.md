# Evidencias Técnicas - Práctica 5

## ComicRent - Kubernetes, Helm, RabbitMQ y Resiliencia

**Carnet:** 202307705  
**Curso:** Software Avanzado  
**Práctica:** 5  
**Proyecto:** ComicRent  
**Namespace:** `sa-p5`

---

# 1. Objetivo de la documentación

Este documento reúne las principales evidencias técnicas obtenidas durante la implementación de la Práctica 5.

La solución parte de la arquitectura de microservicios desarrollada en P4 y agrega capacidades de operación sobre Kubernetes mediante Helm, persistencia, mensajería asíncrona, aislamiento de red, seguridad, escalamiento, resiliencia, CronJobs, pruebas de carga y procedimientos de actualización y rollback.

Las evidencias incluidas corresponden a ejecuciones reales realizadas sobre un clúster local Minikube.

---

# 2. Arquitectura desplegada

La arquitectura final incluye:

```text
Cliente
   |
   | kubectl port-forward
   v
API Gateway
   |
   +--> Auth Service
   +--> Comics Service
   +--> Rentals Service
   +--> Copies Service
             ^
             |
             |
Rentals ----> RabbitMQ ----> Copies Consumer
                          |
                          +----> Summary Consumer

PostgreSQL
   |
   +--> auth_db
   +--> comics_db
   +--> rentals_db
   +--> copies_db
   +--> operations_db

Cron Tick ----> PostgreSQL
Cron Summary --> PostgreSQL
Cron Summary --> RabbitMQ --> Summary Consumer
```

El API Gateway es el único componente utilizado como punto de entrada desde el exterior del clúster.

Los microservicios utilizan Services de tipo:

```text
ClusterIP
```

y las comunicaciones internas son controladas mediante NetworkPolicies.

---

# 3. Estado general del clúster

Se utilizó el script:

```powershell
.\scripts\verify-cluster.ps1
```

para verificar de forma centralizada el estado de la práctica.

Los principales Deployments se encontraron disponibles:

```text
comicrent-api-gateway        1/1
comicrent-auth-service       1/1
comicrent-comics-service     1/1
comicrent-copies-consumer    1/1
comicrent-copies-service     1/1
comicrent-rentals-service    1/1
comicrent-summary-consumer   1/1
```

Los componentes persistentes también se encontraron disponibles:

```text
comicrent-postgresql   1/1
comicrent-rabbitmq     1/1
```

Esto confirma que todos los componentes principales del sistema estaban desplegados correctamente.

---

# 4. Helm

## 4.1 Validación del chart

Antes de realizar el despliegue se ejecutó:

```powershell
helm dependency update . --skip-refresh
```

El chart contiene nueve dependencias:

```text
api-gateway
auth-service
comics-service
rentals-service
copies-service
copies-consumer
operations-jobs
postgresql
rabbitmq
```

Posteriormente se ejecutó:

```powershell
helm lint . -f values-dev.yaml
```

Resultado:

```text
1 chart(s) linted, 0 chart(s) failed
```

Esto confirma que el chart no presentaba errores de sintaxis o estructura detectables por Helm.

---

# 5. Despliegue mediante Helm

La actualización final fue ejecutada mediante:

```powershell
helm upgrade comicrent . `
  -f values-dev.yaml `
  --wait `
  --timeout 10m
```

Resultado:

```text
Release "comicrent" has been upgraded. Happy Helming!

NAME: comicrent
STATUS: deployed
REVISION: 11
DESCRIPTION: Upgrade complete
```

La aplicación quedó desplegada correctamente en la revisión 11.

---

# 6. Namespace

Los recursos de la aplicación se despliegan en:

```text
sa-p5
```

Evidencia:

```text
NAME    STATUS
sa-p5   Active
```

El namespace es creado por el propio chart Helm y no requiere creación manual mediante `kubectl create namespace`.

---

# 7. PostgreSQL StatefulSet

PostgreSQL se encuentra desplegado como StatefulSet:

```text
NAME                   READY
comicrent-postgresql   1/1
```

Esto permite mantener una identidad estable para el Pod y asociarlo a almacenamiento persistente.

---

# 8. PostgreSQL Headless Service

El StatefulSet utiliza un Service headless.

Evidencia:

```text
comicrent-postgresql       10.96.219.43
comicrent-postgresql-hl    None
```

El valor:

```text
CLUSTER-IP = None
```

en:

```text
comicrent-postgresql-hl
```

confirma que se trata de un Service headless.

---

# 9. Bases de datos

Dentro del servidor PostgreSQL se mantienen cinco bases de datos lógicas:

```text
auth_db
comics_db
rentals_db
copies_db
operations_db
```

Las primeras cuatro corresponden a los dominios funcionales de P4.

La base:

```text
operations_db
```

fue agregada específicamente para los procesos de P5 relacionados con CronJobs y resúmenes.

---

# 10. Persistencia PostgreSQL

PostgreSQL posee un PersistentVolumeClaim:

```text
data-comicrent-postgresql-0
```

Estado:

```text
STATUS: Bound
CAPACITY: 2Gi
ACCESS MODES: RWO
```

Evidencia:

```text
data-comicrent-postgresql-0   Bound   2Gi   RWO
```

La persistencia fue validada eliminando el Pod de PostgreSQL.

El StatefulSet recreó automáticamente el Pod y los datos almacenados previamente continuaron disponibles.

Esto demuestra que los datos no dependen del ciclo de vida del Pod.

---

# 11. Persistencia RabbitMQ

RabbitMQ también utiliza almacenamiento persistente.

PVC:

```text
data-comicrent-rabbitmq-0
```

Evidencia:

```text
data-comicrent-rabbitmq-0   Bound   1Gi   RWO
```

Esto permite mantener el estado de RabbitMQ independientemente de una recreación del Pod.

---

# 12. RabbitMQ

RabbitMQ se encuentra desplegado como StatefulSet:

```text
comicrent-rabbitmq   1/1
```

Servicios disponibles:

```text
comicrent-rabbitmq
comicrent-rabbitmq-headless
```

El Service headless presenta:

```text
CLUSTER-IP = None
```

---

# 13. Colas RabbitMQ

Las colas fueron consultadas mediante:

```powershell
kubectl exec `
  -n sa-p5 `
  comicrent-rabbitmq-0 `
  -- rabbitmqctl list_queues `
  name `
  durable `
  messages_ready `
  messages_unacknowledged `
  consumers
```

Resultado:

```text
operations.hourly.summary   true   0   0   1
copies.return.requested     true   0   0   1
```

Esto demuestra que:

```text
copies.return.requested
```

y:

```text
operations.hourly.summary
```

son colas durables.

Además, ambas contaban con un consumer activo durante la verificación.

---

# 14. Flujo asíncrono de devoluciones

El flujo de negocio implementado es:

```text
Rentals Service
      |
      v
RabbitMQ
      |
      v
copies.return.requested
      |
      v
Copies Consumer
      |
      v
PostgreSQL
```

Cuando se procesa una devolución:

1. Rentals publica un evento.
2. RabbitMQ conserva el mensaje.
3. Copies Consumer recibe el evento.
4. Se actualiza la copia.
5. Se registra el evento procesado.
6. Se confirma la transacción en PostgreSQL.
7. Después de completar correctamente el procesamiento se realiza ACK.

Esto evita confirmar mensajes antes de que el cambio de negocio se haya aplicado correctamente.

---

# 15. Idempotencia del consumer

Para evitar procesamientos duplicados se utiliza:

```text
processed_events
```

Cada evento posee un identificador único:

```text
event_id
```

Antes de procesar un evento se verifica si ya existe.

Si el evento ya había sido procesado:

```text
no se repite la operación
```

y se confirma mediante ACK.

Esto permite manejar entregas repetidas de RabbitMQ sin provocar inconsistencias.

---

# 16. Prueba de consumer caído

Se realizó una prueba deteniendo intencionalmente el consumer de copias.

Comando:

```powershell
kubectl scale deployment comicrent-copies-consumer `
  --replicas=0 `
  -n sa-p5
```

Mientras el consumer permaneció detenido se generaron eventos de devolución.

Durante ese período RabbitMQ presentó:

```text
consumers = 0
messages_ready > 0
```

Las solicitudes de devolución pudieron completarse, pero los mensajes permanecieron pendientes en RabbitMQ.

Posteriormente se restauró el consumer:

```powershell
kubectl scale deployment comicrent-copies-consumer `
  --replicas=1 `
  -n sa-p5
```

Después de iniciar nuevamente:

```text
messages_ready = 0
consumers = 1
```

Los mensajes acumulados fueron procesados y las copias correspondientes cambiaron correctamente a estado disponible.

Esta prueba demuestra desacoplamiento y persistencia del flujo asíncrono.

---

# 17. NetworkPolicies

La solución utiliza aislamiento de red mediante:

```text
NetworkPolicy
```

Entre las políticas creadas se encuentran:

```text
comicrent-default-deny
comicrent-allow-dns
comicrent-api-gateway
comicrent-auth-service
comicrent-comics-service
comicrent-rentals-service
comicrent-copies-service
comicrent-copies-consumer
comicrent-cron-tick
comicrent-cron-summary
comicrent-summary-consumer
comicrent-postgresql
comicrent-rabbitmq
comicrent-upgrade-test
```

---

# 18. Política default deny

La política:

```text
comicrent-default-deny
```

establece una estrategia de denegación por defecto.

Después se permiten únicamente las comunicaciones requeridas por la arquitectura.

Esto permite implementar una lista explícita de comunicaciones autorizadas.

---

# 19. Flujos permitidos

Los principales flujos autorizados son:

```text
Gateway -> Auth
Gateway -> Comics
Gateway -> Rentals
Gateway -> Copies

Rentals -> Comics
Rentals -> Copies
Rentals -> RabbitMQ

Copies Consumer -> PostgreSQL
Copies Consumer -> RabbitMQ

Cron Tick -> PostgreSQL

Cron Summary -> PostgreSQL
Cron Summary -> RabbitMQ

Summary Consumer -> PostgreSQL
Summary Consumer -> RabbitMQ
```

También se permite acceso DNS para resolución de nombres internos.

---

# 20. Prueba de aislamiento

Durante las pruebas se verificaron flujos permitidos y bloqueados.

Ejemplos de flujos permitidos:

```text
Rentals -> RabbitMQ
Copies Consumer -> PostgreSQL
Summary Consumer -> RabbitMQ
```

Ejemplos de flujos bloqueados:

```text
Rentals -> Auth
Summary Consumer -> Auth
Copies Service -> RabbitMQ
```

Los intentos de comunicación no autorizados terminaron en timeout.

Esto demuestra que las NetworkPolicies efectivamente restringen el tráfico lateral.

---

# 21. API Gateway como único punto de entrada

Los Services de los microservicios son:

```text
ClusterIP
```

No se utiliza:

```text
NodePort
LoadBalancer
Ingress
```

para exponer directamente los microservicios.

El acceso local se realiza mediante:

```powershell
kubectl port-forward `
  service/comicrent-api-gateway `
  3100:3000 `
  -n sa-p5
```

El Gateway queda disponible en:

```text
http://localhost:3100
```

---

# 22. Probes de salud

Todos los componentes principales utilizan mecanismos de health check.

Los servicios HTTP utilizan:

```text
startupProbe
readinessProbe
livenessProbe
```

principalmente sobre:

```text
/health
```

Los consumers utilizan probes `exec`.

---

# 23. Copies Consumer - Probes

Se verificó mediante:

```powershell
kubectl get deployment comicrent-copies-consumer `
  -n sa-p5 `
  -o yaml
```

El Deployment contiene:

```text
startupProbe
readinessProbe
livenessProbe
```

La configuración valida variables esenciales como:

```text
DATABASE_URL
RABBITMQ_HOST
```

Evidencia:

```text
startupProbe    presente
readinessProbe  presente
livenessProbe   presente
```

---

# 24. Summary Consumer - Probes

También se verificó:

```text
comicrent-summary-consumer
```

El Deployment contiene:

```text
startupProbe
readinessProbe
livenessProbe
```

con verificaciones sobre la configuración necesaria para PostgreSQL y RabbitMQ.

---

# 25. Horizontal Pod Autoscaler

El API Gateway utiliza HPA.

Configuración:

```text
minReplicas: 1
maxReplicas: 2
CPU target: 40%
```

Evidencia:

```text
NAME                    TARGETS       MINPODS   MAXPODS   REPLICAS
comicrent-api-gateway   cpu: 2%/40%   1         2         1
```

El HPA permanece con una réplica cuando la carga es baja.

---

# 26. Prueba de carga con k6

La prueba se encuentra en:

```text
P5/load-test/gateway-health.js
```

La prueba utiliza etapas progresivas de carga.

Configuración utilizada:

```text
20 s -> 30 VUs
40 s -> 80 VUs
40 s -> 120 VUs
20 s -> 0 VUs
```

El endpoint probado fue:

```text
GET /health
```

del API Gateway.

---

# 27. Resultado de k6

La prueba final produjo aproximadamente:

```text
Solicitudes totales: 30,476
RPS:                 253.86 req/s
p95:                 536.72 ms
Errores HTTP:        0.00 %
Checks exitosos:     100 %
Máximo de VUs:       120
```

Los thresholds configurados fueron cumplidos.

---

# 28. Escalamiento observado

Durante la prueba de carga el HPA presentó valores como:

```text
1% / 40%
55% / 40%
300% / 40%
111% / 40%
```

Al superar el umbral configurado se produjo el escalamiento:

```text
1 réplica
   |
   v
2 réplicas
```

El nuevo Pod pasó por:

```text
Pending
ContainerCreating
Running
```

hasta quedar disponible.

Posteriormente, al disminuir la carga, el HPA regresó el Deployment a una réplica.

---

# 29. ResourceQuota

El namespace utiliza:

```text
comicrent-quota
```

Durante la verificación se observó:

```text
requests.cpu:        925m / 2
requests.memory:     1184Mi / 2Gi
requests.storage:    3Gi / 10Gi

limits.cpu:          2380m / 4
limits.memory:       2176Mi / 4Gi

persistentvolumeclaims: 2 / 5
services:               9 / 15
```

Esto demuestra que el namespace posee restricciones explícitas sobre el consumo máximo de recursos.

---

# 30. LimitRange

También se utiliza:

```text
comicrent-limits
```

El LimitRange define límites mínimos, máximos y valores predeterminados para recursos de los contenedores.

Evidencia:

```text
NAME
comicrent-limits
```

---

# 31. PodDisruptionBudget

Los principales microservicios poseen PDB.

Evidencia:

```text
comicrent-api-gateway
comicrent-auth-service
comicrent-comics-service
comicrent-copies-service
comicrent-rentals-service
```

También existen PDB provenientes de las dependencias para:

```text
comicrent-postgresql
comicrent-rabbitmq
```

Los microservicios utilizan:

```text
minAvailable: 1
```

Con una sola réplica es normal observar:

```text
ALLOWED DISRUPTIONS = 0
```

ya que Kubernetes debe mantener al menos una instancia disponible.

---

# 32. RollingUpdate

Los Deployments utilizan estrategia:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 1
```

Esto permite crear una nueva instancia antes de retirar la anterior.

---

# 33. Prueba de Zero Downtime

Para evitar confundir la terminación de un proceso local `kubectl port-forward` con una caída real del servicio, la prueba de disponibilidad se realizó desde dentro del clúster contra el Service del Gateway.

Se creó un Pod de prueba con una label autorizada por NetworkPolicy.

El Pod realizó solicitudes repetidas contra:

```text
http://comicrent-api-gateway:3000/health
```

mientras se ejecutaba un upgrade.

Durante el rollout se observó:

```text
nuevo Pod -> Ready
viejo Pod -> Terminating
```

La salida del cliente mostró únicamente:

```text
HTTP 200
```

durante la actualización.

Esto demuestra que el Service continuó disponible mientras se reemplazaba el Pod del Gateway.

---

# 34. NetworkPolicy de prueba de upgrade

Para permitir únicamente la prueba de disponibilidad se creó:

```text
comicrent-upgrade-test
```

con selector:

```text
comicrent.io/upgrade-test=true
```

La política permanece en el chart para permitir que la prueba pueda reproducirse.

Si no existe un Pod con esa label, la política no habilita tráfico adicional.

---

# 35. CronJob cada 2 minutos

El primer CronJob se ejecuta mediante:

```text
*/2 * * * *
```

Zona horaria:

```text
America/Guatemala
```

Su función es insertar periódicamente:

```text
fecha/hora GMT-6
carnet 202307705
```

en:

```text
operations_db
```

---

# 36. Evidencia del CronJob de 2 minutos

Durante la verificación se observaron ejecuciones:

```text
comicrent-cron-tick-29794736   Completed
comicrent-cron-tick-29794738   Completed
comicrent-cron-tick-29794740   Completed
```

Además:

```text
ACTIVE = 0
```

indica que las ejecuciones anteriores terminaron correctamente.

---

# 37. CronJob cada 10 minutos

El segundo CronJob utiliza:

```text
*/10 * * * *
```

con:

```text
America/Guatemala
```

El flujo es:

```text
consulta datos
    |
    v
genera resumen
    |
    v
publica RabbitMQ
    |
    v
operations.hourly.summary
    |
    v
Summary Consumer
    |
    v
PostgreSQL
```

---

# 38. Evidencia del CronJob de 10 minutos

Durante la verificación se observaron ejecuciones:

```text
comicrent-cron-summary-29794720   Completed
comicrent-cron-summary-29794730   Completed
comicrent-cron-summary-29794740   Completed
```

Esto demuestra que el Job se ejecutaba automáticamente de acuerdo con su schedule.

---

# 39. Configuración de CronJobs

Ambos CronJobs utilizan:

```yaml
timeZone: "America/Guatemala"
concurrencyPolicy: Forbid
successfulJobsHistoryLimit: 3
failedJobsHistoryLimit: 3
```

Además:

```yaml
backoffLimit: 2
```

Esto evita la ejecución simultánea del mismo CronJob y controla los reintentos e historial.

---

# 40. Summary Consumer

El Summary Consumer se mantiene activo como Deployment:

```text
comicrent-summary-consumer   1/1
```

Durante la verificación RabbitMQ presentó:

```text
operations.hourly.summary
durable = true
consumers = 1
```

Esto demuestra que el consumer se encontraba conectado a la cola correspondiente.

---

# 41. ServiceAccounts

Cada workload principal utiliza un ServiceAccount específico.

Evidencia:

```text
comicrent-api-gateway
comicrent-auth-service
comicrent-comics-service
comicrent-copies-consumer
comicrent-copies-service
comicrent-cron-summary
comicrent-cron-tick
comicrent-rentals-service
comicrent-summary-consumer
```

PostgreSQL y RabbitMQ también poseen sus propios ServiceAccounts.

---

# 42. RBAC

Los workloads utilizan:

```text
Role
RoleBinding
```

dedicados.

Por ejemplo:

```text
comicrent-cron-tick
comicrent-cron-summary
comicrent-summary-consumer
```

poseen cada uno:

```text
ServiceAccount
Role
RoleBinding
```

independientes.

Esto evita compartir una identidad Kubernetes común entre procesos diferentes.

---

# 43. SecurityContext

Los contenedores se ejecutan con restricciones de seguridad.

Entre las propiedades utilizadas se encuentran:

```text
runAsNonRoot: true
readOnlyRootFilesystem: true
allowPrivilegeEscalation: false
```

y:

```text
capabilities:
  drop:
    - ALL
```

Además se utiliza:

```text
seccompProfile: RuntimeDefault
```

Estas configuraciones reducen los privilegios disponibles dentro de los contenedores.

---

# 44. Optimización de imágenes

Las imágenes fueron optimizadas mediante Dockerfiles multi-stage y bases reducidas.

Comparación obtenida:

| Servicio | Antes | Después |
|---|---:|---:|
| API Gateway | 497 MB Slim | 319 MB Alpine |
| Auth Service | 1.44 GB Slim | 1.33 GB Alpine |
| Comics Service | 1.53 GB Slim | 1.41 GB Alpine |
| Rentals Service | 293 MB Slim | 190 MB Alpine |
| Copies Service | 279 MB Slim | 176 MB Alpine |
| Operations Jobs | - | 94.7 MB Alpine |

---

# 45. Comparación Alpine vs Distroless

También se evaluó una alternativa Distroless para algunos servicios.

En Rentals se obtuvo aproximadamente:

```text
Alpine:      190 MB
Distroless:  196 MB
```

Por lo tanto se mantuvo Alpine como imagen final debido a su tamaño competitivo y mayor facilidad de operación y diagnóstico.

---

# 46. Versionado Helm

El chart comenzó con:

```text
Chart version: 0.1.0
App version:   1.0.0
```

Posteriormente fue actualizado a:

```text
Chart version: 0.2.0
App version:   1.1.0
```

Esto demuestra versionado explícito del chart y de la aplicación.

---

# 47. Historial Helm

Se ejecutó:

```powershell
helm history comicrent
```

Entre las revisiones observadas se encuentran:

```text
REVISION 6
comicrent-0.1.0
Upgrade complete

REVISION 7
comicrent-0.1.0
Upgrade complete

REVISION 8
comicrent-0.1.0
Rollback to 6

REVISION 9
comicrent-0.2.0
App version 1.1.0
Upgrade complete

REVISION 10
failed

REVISION 11
comicrent-0.2.0
App version 1.1.0
deployed
Upgrade complete
```

---

# 48. Rollback Helm

Se ejecutó un rollback real mediante:

```powershell
helm rollback comicrent 6 `
  --wait `
  --timeout 10m
```

El historial creó una nueva revisión:

```text
REVISION 8
DESCRIPTION: Rollback to 6
```

Esto confirma que Helm restauró correctamente una revisión anterior.

---

# 49. Revisión fallida y recuperación

Durante una actualización se generó:

```text
REVISION 10
STATUS: failed
```

Motivo:

```text
Deployment comicrent-copies-consumer not ready
Pending termination
```

El problema fue corregido y posteriormente se realizó una nueva actualización.

Resultado:

```text
REVISION 11
STATUS: deployed
DESCRIPTION: Upgrade complete
```

La revisión fallida se conserva en el historial como evidencia del proceso de diagnóstico y recuperación.

---

# 50. Scripts de automatización

Se agregaron scripts PowerShell en:

```text
P5/scripts/
```

Contenido:

```text
build-images.ps1
helm-version.ps1
helm-upgrade.ps1
helm-rollback.ps1
verify-cluster.ps1
```

---

# 51. build-images.ps1

El script automatiza:

```text
docker build
docker tag
docker push
minikube image load
```

para las imágenes de la solución.

El registry configurado para publicación puede utilizar:

```text
docker.io/davidvela777
```

Ejemplo:

```powershell
.\scripts\build-images.ps1 `
  -Tag "1.0.0" `
  -Registry "docker.io/davidvela777" `
  -Push
```

---

# 52. helm-version.ps1

Este script permite modificar de manera controlada:

```text
version
appVersion
```

en:

```text
Chart.yaml
```

Además ejecuta `helm lint` después del cambio.

---

# 53. helm-upgrade.ps1

Automatiza:

```text
helm dependency update
helm lint
helm history
helm upgrade
kubectl rollout status
helm status
```

Permite reproducir el procedimiento utilizado durante los upgrades de la práctica.

---

# 54. helm-rollback.ps1

Automatiza:

```text
helm history
helm rollback
kubectl rollout status
helm status
```

y recibe como parámetro la revisión que se desea restaurar.

---

# 55. verify-cluster.ps1

El script de verificación consulta:

```text
Namespace
Pods
Deployments
StatefulSets
Services
PVC
HPA
PDB
NetworkPolicies
ServiceAccounts
Roles
RoleBindings
CronJobs
ResourceQuota
LimitRange
métricas
colas RabbitMQ
Helm status
Helm history
```

El script fue ejecutado correctamente y se utilizó como comprobación final del estado de la práctica.

---

# 56. Validación de sintaxis de scripts

Se realizó validación sintáctica mediante el parser de PowerShell.

Resultado:

```text
build-images.ps1       Sintaxis OK
helm-rollback.ps1      Sintaxis OK
helm-upgrade.ps1       Sintaxis OK
helm-version.ps1       Sintaxis OK
verify-cluster.ps1     Sintaxis OK
```

Esto confirma que todos los scripts agregados al repositorio son sintácticamente válidos.

---

# 57. Estado final

El estado final observado fue:

```text
API Gateway          Running
Auth Service         Running
Comics Service       Running
Rentals Service      Running
Copies Service       Running
Copies Consumer      Running
Summary Consumer     Running
PostgreSQL           Running
RabbitMQ             Running
```

Los Jobs anteriores aparecían como:

```text
Completed
```

lo cual corresponde a ejecuciones terminadas correctamente.

---

# 58. Resumen de cumplimiento técnico

La implementación evidencia:

```text
Helm chart padre
Subcharts
values por ambiente
funciones avanzadas Helm
Namespace administrado por chart
ConfigMaps
Secrets
PostgreSQL StatefulSet
PVC
Headless Service
RabbitMQ
colas durables
flujo asíncrono
ACK posterior al procesamiento
idempotencia
prueba de consumer caído
NetworkPolicies
default deny
health probes
HPA
prueba de carga k6
ResourceQuota
LimitRange
PDB
RollingUpdate
Zero Downtime
ServiceAccounts
RBAC
SecurityContext
CronJobs
GMT-6
versionado
upgrade
rollback
optimización de imágenes
scripts de automatización
```

---

# 59. Preguntas teóricas

## 59.1 ¿Qué es Helm y qué problema resuelve frente a los manifiestos sueltos?

Helm es un gestor de paquetes para Kubernetes. Permite agrupar recursos como Deployments, Services, ConfigMaps, Secrets, StatefulSets, CronJobs, NetworkPolicies y demás objetos dentro de una unidad reutilizable llamada **chart**.

Con manifiestos YAML sueltos es común duplicar archivos para cada ambiente, modificar valores manualmente y perder el control de qué versión fue instalada. Helm resuelve estos problemas mediante:

- Templates parametrizables.
- Archivos `values.yaml` y valores específicos por ambiente.
- Reutilización de subcharts.
- Instalaciones y actualizaciones reproducibles.
- Historial de revisiones de cada despliegue.
- Operaciones de upgrade y rollback.

En ComicRent, el chart padre coordina los microservicios, PostgreSQL, RabbitMQ y los Jobs, mientras `values-dev.yaml` y `values-prod.yaml` permiten cambiar la configuración sin duplicar todos los manifiestos.

---

## 59.2 ¿Cuál es la diferencia entre chart, release y repository?

- **Chart:** paquete que contiene los templates, valores, metadatos y dependencias necesarios para describir una aplicación en Kubernetes. En esta práctica, `comicrent` es el chart padre.
- **Release:** instancia concreta de un chart instalada en un clúster. Una misma chart puede instalarse varias veces con nombres y valores diferentes. `comicrent` es también el nombre elegido para la release de esta práctica.
- **Repository:** servidor o catálogo desde el cual se publican y descargan charts versionados. Por ejemplo, los charts de PostgreSQL y RabbitMQ se obtienen del repository de Bitnami.

Por tanto, el chart es el paquete, la release es una instalación de ese paquete y el repository es el lugar desde donde se distribuyen charts.

---

## 59.3 ¿Qué es un StatefulSet y cuándo NO debe utilizarse?

Un StatefulSet es un controlador de Kubernetes diseñado para aplicaciones que requieren identidad estable, nombres de red predecibles, almacenamiento persistente asociado a cada réplica y creación o terminación ordenada de Pods. Por ejemplo, un Pod de PostgreSQL puede conservar su identidad y volver a montar su volumen después de ser recreado.

No debe utilizarse únicamente porque una aplicación almacene datos temporalmente ni como reemplazo general de un Deployment. Para servicios sin estado, réplicas intercambiables, APIs, gateways y consumers que guardan su estado fuera del Pod, normalmente debe utilizarse un Deployment. Un StatefulSet agrega administración y restricciones innecesarias si la aplicación no necesita identidad o almacenamiento estable por réplica.

En ComicRent, PostgreSQL y RabbitMQ requieren persistencia y se ejecutan como StatefulSets, mientras los microservicios y consumers se administran mediante Deployments.

---

## 59.4 ¿Cuál es la diferencia entre liveness, readiness y startup probe?

- **Startup probe:** determina si la aplicación terminó de iniciar. Mientras no tenga éxito, Kubernetes no ejecuta las probes de liveness y readiness. Es útil para aplicaciones cuyo arranque puede ser lento.
- **Readiness probe:** determina si el contenedor está listo para recibir tráfico o realizar su trabajo. Si falla, el Pod permanece en ejecución, pero se marca como no disponible y se retira de los endpoints de los Services.
- **Liveness probe:** determina si el proceso continúa funcionando correctamente. Cuando falla repetidamente, el kubelet reinicia el contenedor.

La startup probe protege un arranque lento, la readiness controla la disponibilidad y la liveness permite recuperar procesos bloqueados. Una probe debe comprobar una condición real y utilizar variables o endpoints que existan; una probe mal configurada puede impedir un upgrade aunque la aplicación esté ejecutándose.

---

## 59.5 ¿Qué es una NetworkPolicy y por qué el tráfico es permitido por defecto?

Una NetworkPolicy define qué tráfico de entrada y salida está permitido para grupos de Pods seleccionados por labels. Puede limitar la comunicación según otros Pods, namespaces, bloques IP y puertos.

Kubernetes adopta inicialmente un modelo abierto para conservar compatibilidad y facilitar que las aplicaciones se comuniquen: si ninguna NetworkPolicy selecciona un Pod para una dirección determinada, todo el tráfico de esa dirección está permitido. Cuando una política selecciona el Pod para `Ingress`, `Egress` o ambos, el Pod queda aislado en esas direcciones y solamente se permiten las conexiones autorizadas explícitamente por las políticas aplicables.

La aplicación práctica de las políticas también requiere un plugin de red compatible, como Calico. En ComicRent se parte de políticas `default deny` y después se habilitan únicamente los flujos necesarios entre Gateway, microservicios, PostgreSQL, RabbitMQ y DNS.

---

## 59.6 ¿Qué es un PodDisruptionBudget?

Un PodDisruptionBudget, o PDB, limita cuántas réplicas de una aplicación pueden quedar simultáneamente no disponibles durante interrupciones **voluntarias**, como el drenado de un nodo, mantenimiento o ciertas operaciones administrativas. Se expresa mediante `minAvailable` o `maxUnavailable`.

Un PDB no crea réplicas, no reemplaza las probes, no garantiza alta disponibilidad y no evita interrupciones involuntarias como fallos de hardware, caída del proceso o pérdida del nodo. Además, con una sola réplica y `minAvailable: 1`, un drenado puede quedar bloqueado hasta que exista otra réplica disponible o se modifique el presupuesto.

En ComicRent se utiliza `minAvailable: 1` para proteger la disponibilidad de los componentes durante disrupciones voluntarias.

---

## 59.7 ¿Qué ventajas y qué nuevos problemas introduce la comunicación asíncrona?

La comunicación asíncrona desacopla temporalmente al productor y al consumidor. Sus principales ventajas son:

- El productor no necesita esperar a que el consumidor termine.
- Los mensajes pueden acumularse si un consumidor se encuentra temporalmente caído.
- Permite absorber picos de carga y procesarlos gradualmente.
- Facilita agregar consumidores y escalar el procesamiento.
- Reduce el acoplamiento directo entre servicios.

También introduce nuevos problemas:

- Consistencia eventual en lugar de resultados inmediatos.
- Posibles mensajes duplicados y necesidad de idempotencia.
- Riesgo de mensajes perdidos si no se configuran durabilidad, confirmaciones y ACK correctamente.
- Reintentos, mensajes imposibles de procesar y necesidad de colas de mensajes muertos.
- Mayor dificultad para rastrear, depurar y observar un flujo distribuido.
- Posible procesamiento fuera de orden.
- Operación y monitoreo adicional del broker.

En ComicRent, RabbitMQ permite conservar eventos mientras un consumer está detenido. Los consumers confirman el mensaje después de procesarlo y aplican idempotencia para tolerar reentregas.

---

## 59.8 ¿Qué hace `helm rollback` internamente?

`helm rollback <release> <revisión>` consulta el historial almacenado por Helm, recupera el manifiesto y la configuración correspondientes a la revisión indicada y los compara con el estado de la release actual. Después ejecuta una actualización hacia ese estado anterior: crea, aplica, modifica o elimina recursos de Kubernetes según las diferencias encontradas.

El rollback no borra el historial ni cambia el código fuente o el repositorio Git. El resultado se registra como una **nueva revisión** de la release, cuya descripción indica que corresponde a un rollback. Dependiendo de las opciones utilizadas, Helm también puede ejecutar hooks y esperar a que los recursos queden listos.

Helm restaura los manifiestos administrados por la release, pero esto no implica necesariamente revertir datos persistentes, migraciones de base de datos ni cambios realizados fuera de Helm. Por ello, la compatibilidad de datos debe considerarse antes de regresar una versión de la aplicación.

---

# 60. Conclusión

La Práctica 5 permitió evolucionar ComicRent desde una arquitectura de microservicios funcional hacia un entorno administrado mediante Kubernetes y Helm.

La solución incorpora persistencia, seguridad, aislamiento, resiliencia, escalamiento y procesamiento asíncrono sin eliminar las comunicaciones síncronas requeridas por los flujos de negocio existentes.

Las pruebas realizadas demostraron:

- Persistencia ante recreación de Pods.
- Acumulación y recuperación de mensajes cuando un consumer se encuentra detenido.
- Restricción efectiva de comunicaciones mediante NetworkPolicies.
- Escalamiento automático por consumo de CPU.
- Ejecución programada de CronJobs.
- Actualizaciones mediante RollingUpdate sin interrupción del Service.
- Versionado y rollback mediante Helm.
- Reducción del tamaño de imágenes.
- Automatización de tareas operativas mediante scripts PowerShell.

El estado final del clúster confirmó que todos los componentes principales se encontraban operativos y que la solución podía ser administrada de forma reproducible mediante Helm y los scripts incluidos en el repositorio.
