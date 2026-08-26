# Guía de Calificación e Inicio - Práctica 5 ComicRent

**Carnet:** 202307705  
**Curso:** Software Avanzado  
**Práctica:** 5  
**Proyecto:** ComicRent  
**Namespace:** `sa-p5`  
**Helm:** Helm 4  
**Registry:** `docker.io/davidvela777`

---

# 1. Objetivo

Esta guía sirve para:

- iniciar el proyecto antes de la calificación;
- verificar que Kubernetes, Helm, PostgreSQL y RabbitMQ estén funcionando;
- demostrar la aplicación mediante Swagger;
- utilizar la interfaz web de RabbitMQ;
- mostrar comunicación síncrona y asíncrona;
- demostrar consumer caído y recuperación;
- demostrar CronJobs;
- demostrar NetworkPolicies;
- ejecutar una prueba de carga con k6;
- modificar de forma controlada la intensidad de la prueba k6;
- observar el escalamiento del HPA;
- mostrar persistencia, probes, RBAC, PDB, RollingUpdate, history y rollback.

> Recomendación: llegar a la evaluación con Docker Desktop y Minikube ya iniciados. No destruir el clúster antes de la calificación.

---

# 2. Arquitectura que se debe explicar

La arquitectura general es:

```text
Usuario / Navegador
        |
        | kubectl port-forward
        v
    API Gateway
        |
        +----> Auth Service
        +----> Comics Service
        +----> Rentals Service
        +----> Copies Service

Rentals Service
        |
        | evento copy.return.requested
        v
     RabbitMQ
        |
        v
 Copies Consumer
        |
        v
   PostgreSQL

Cron Tick ----------------------------> operations_db

Cron Summary ---> RabbitMQ ---> Summary Consumer ---> operations_db
```

## Flujos síncronos

```text
Gateway -> Auth
Gateway -> Comics
Gateway -> Rentals
Gateway -> Copies
Rentals -> Comics
Rentals -> Copies
```

## Flujos asíncronos

```text
Rentals -> RabbitMQ -> Copies Consumer

Cron Summary -> RabbitMQ -> Summary Consumer
```

## NetworkPolicies

Explicar:

> El namespace utiliza una política `Default Deny` y posteriormente se habilitan únicamente los flujos requeridos por el sistema. Las NetworkPolicies funcionan como una allowlist.

---

# 3. Terminales recomendadas

Preparar cuatro PowerShell.

## Terminal 1 - Comandos generales

```powershell
cd C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5
```

## Terminal 2 - API Gateway

Se utilizará para mantener activo:

```powershell
kubectl port-forward service/comicrent-api-gateway 3100:3000 -n sa-p5
```

## Terminal 3 - RabbitMQ Management

Se utilizará para mantener activo:

```powershell
kubectl port-forward service/comicrent-rabbitmq 15672:15672 -n sa-p5
```

## Terminal 4 - Observación HPA

Durante k6:

```powershell
kubectl get hpa -n sa-p5 -w
```

Opcionalmente abrir una quinta terminal para:

```powershell
kubectl get pods -n sa-p5 -w
```

---

# 4. Iniciar Docker y Minikube

Primero iniciar Docker Desktop.

Después:

```powershell
minikube status
```

Resultado esperado:

```text
host: Running
kubelet: Running
apiserver: Running
kubeconfig: Configured
```

Verificar nodo:

```powershell
kubectl get nodes
```

Resultado esperado:

```text
minikube   Ready
```

### Qué decir

> La práctica se ejecuta sobre un clúster Kubernetes local administrado con Minikube.

---

# 5. Si Minikube está detenido

Iniciar:

```powershell
minikube start
```

Para una instalación desde cero se recomienda:

```powershell
minikube start `
  --memory=4096 `
  --cpus=4
```

Después:

```powershell
kubectl get nodes
```

---

# 6. Verificación completa del proyecto

Desde:

```powershell
cd C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5
```

ejecutar:

```powershell
.\scripts\verify-cluster.ps1
```

Debe verificar:

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
Métricas
RabbitMQ
Helm status
Helm history
```

Los principales componentes deben aparecer:

```text
comicrent-api-gateway        1/1 Running
comicrent-auth-service       1/1 Running
comicrent-comics-service     1/1 Running
comicrent-rentals-service    1/1 Running
comicrent-copies-service     1/1 Running
comicrent-copies-consumer    1/1 Running
comicrent-summary-consumer   1/1 Running
comicrent-postgresql-0       1/1 Running
comicrent-rabbitmq-0         1/1 Running
```

Los Pods históricos de CronJobs pueden aparecer:

```text
Completed
```

Esto es correcto.

---

# 7. Verificar Helm

Entrar al chart:

```powershell
cd C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5\helm\comicrent
```

## 7.1 Lint

```powershell
helm lint . -f values-dev.yaml
```

Resultado esperado:

```text
1 chart(s) linted, 0 chart(s) failed
```

## 7.2 Estado

```powershell
helm status comicrent
```

Mostrar:

```text
STATUS: deployed
```

## 7.3 Historial

```powershell
helm history comicrent
```

Señalar:

```text
Revision 8  -> Rollback to 6
Revision 9  -> comicrent-0.2.0 / appVersion 1.1.0
Revision 11 -> deployed / Upgrade complete
```

### Qué decir

> Todo el despliegue de P5 se administra con Helm. Se realizaron upgrades, versionado y rollback real.

Si aparece una revisión fallida, explicar que fue corregida en una revisión posterior exitosa.

---

# 8. Iniciar API Gateway para Swagger

En la Terminal 2:

```powershell
kubectl port-forward `
  service/comicrent-api-gateway `
  3100:3000 `
  -n sa-p5
```

Dejar esta terminal abierta.

Resultado esperado:

```text
Forwarding from 127.0.0.1:3100 -> 3000
```

---

# 9. Probar health

En otra terminal:

```powershell
Invoke-WebRequest http://localhost:3100/health
```

También puede abrirse:

```text
http://localhost:3100/health
```

### Qué decir

> El API Gateway es el único punto de entrada utilizado desde la máquina host. Los microservicios permanecen como Services `ClusterIP`.

Mostrar:

```powershell
kubectl get svc -n sa-p5
```

---

# 10. Abrir Swagger

Abrir en navegador:

```text
http://localhost:3100/docs
```

Usar Swagger para mostrar los endpoints funcionales.

> No utilizar los puertos individuales de Auth, Comics, Rentals o Copies durante la demostración. Las solicitudes deben entrar por el Gateway.

---

# 11. Orden recomendado de endpoints en Swagger

Demostrar:

```text
1. Login / autenticación
2. Consultar cómics
3. Consultar ejemplares
4. Crear una renta
5. Consultar la renta
6. Devolver la renta
```

Los nombres exactos deben tomarse de la documentación Swagger disponible en el Gateway.

---

# 12. Demostración de Auth

Desde Swagger:

1. Si se necesita, registrar un usuario de prueba.
2. Ejecutar login.
3. Mantener la misma sesión de Swagger.

### Qué decir

> La solicitud entra por el API Gateway y es enrutada al Auth Service. La sesión utiliza cookie HTTP-only según la implementación del proyecto.

---

# 13. Demostración de Comics

Consultar el catálogo.

### Qué decir

> El Gateway enruta la operación al Comics Service dentro del clúster.

---

# 14. Demostración de Copies

Consultar ejemplares.

Pueden observarse códigos como:

```text
BAT-001
BAT-002
BAT-003
```

y estados:

```text
DISPONIBLE
ALQUILADO
```

---

# 15. Crear una renta

Crear una renta desde Swagger.

Explicar:

```text
Gateway
   |
   v
Rentals Service
   |
   +----> Comics Service
   |
   +----> Copies Service
```

### Qué decir

> La creación de una renta necesita comunicaciones síncronas entre Rentals, Comics y Copies. Estas comunicaciones están expresamente permitidas por las NetworkPolicies.

---

# 16. Iniciar interfaz web de RabbitMQ

En la Terminal 3:

```powershell
kubectl port-forward `
  service/comicrent-rabbitmq `
  15672:15672 `
  -n sa-p5
```

Dejar abierta.

Abrir en navegador:

```text
http://localhost:15672
```

---

# 17. Obtener usuario y contraseña de RabbitMQ

El usuario configurado es:

```text
comicrent
```

Para obtener la contraseña desde Kubernetes sin escribirla en el repositorio:

```powershell
$RabbitPasswordBase64 = kubectl get secret comicrent-rabbitmq-secret `
  -n sa-p5 `
  -o jsonpath="{.data.rabbitmq-password}"

$RabbitPassword = [System.Text.Encoding]::UTF8.GetString(
  [System.Convert]::FromBase64String($RabbitPasswordBase64)
)

$RabbitPassword
```

Ingresar en:

```text
http://localhost:15672
```

con:

```text
Username: comicrent
Password: valor mostrado por PowerShell
```

> No copiar esta contraseña al README ni al repositorio.

---

# 18. Qué mostrar en RabbitMQ Management UI

Una vez dentro de RabbitMQ:

## Pestaña Overview

Mostrar:

- versión;
- conexiones;
- channels;
- queues;
- message rates.

## Pestaña Queues and Streams

Mostrar:

```text
copies.return.requested
operations.hourly.summary
```

Abrir cada cola y señalar:

- Durable: `true`;
- Consumers;
- Ready;
- Unacked;
- Total.

### Qué decir

> `copies.return.requested` procesa devoluciones de ejemplares y `operations.hourly.summary` procesa los resúmenes generados por el CronJob.

---

# 19. Ver RabbitMQ también por consola

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

Resultado esperado:

```text
operations.hourly.summary   true   0   0   1
copies.return.requested     true   0   0   1
```

---

# 20. Devolución normal

Desde Swagger ejecutar una devolución.

Mientras se hace la devolución, mantener abierta:

```text
RabbitMQ -> Queues and Streams -> copies.return.requested
```

Refrescar la interfaz.

Explicar:

```text
Rentals Service
      |
      | copy.return.requested
      v
RabbitMQ
      |
      v
Copies Consumer
      |
      v
PostgreSQL
```

Luego consultar el ejemplar desde Swagger.

Debe regresar a:

```text
DISPONIBLE
```

### Qué decir

> El consumer realiza ACK únicamente después del procesamiento exitoso y del commit en PostgreSQL.

---

# 21. Prueba de consumer caído usando RabbitMQ UI

Esta es una de las mejores pruebas para la evaluación.

## 21.1 Apagar Copies Consumer

```powershell
kubectl scale deployment comicrent-copies-consumer `
  --replicas=0 `
  -n sa-p5
```

Verificar:

```powershell
kubectl get deployment comicrent-copies-consumer -n sa-p5
```

---

## 21.2 Observar RabbitMQ UI

Ir a:

```text
Queues and Streams
-> copies.return.requested
```

Debe observarse:

```text
Consumers: 0
```

---

## 21.3 Generar una devolución

Desde Swagger ejecutar una devolución mientras el consumer está detenido.

Refrescar la cola en RabbitMQ.

Debe aparecer:

```text
Ready > 0
Consumers = 0
```

### Qué decir

> El mensaje permanece almacenado en RabbitMQ mientras el consumer está detenido.

---

## 21.4 Recuperar consumer

```powershell
kubectl scale deployment comicrent-copies-consumer `
  --replicas=1 `
  -n sa-p5
```

Esperar:

```powershell
kubectl rollout status `
  deployment/comicrent-copies-consumer `
  -n sa-p5
```

Volver a RabbitMQ UI.

Después de unos segundos debe observarse:

```text
Consumers = 1
Ready = 0
```

Consultar el ejemplar nuevamente desde Swagger.

Debe quedar:

```text
DISPONIBLE
```

### Qué demostrar

Con esta prueba se evidencia:

```text
RabbitMQ
cola durable
desacoplamiento
consumer caído
acumulación de mensajes
recuperación automática
ACK posterior al procesamiento
```

---

# 22. Mostrar CronJobs

```powershell
kubectl get cronjobs -n sa-p5
```

Resultado esperado:

```text
comicrent-cron-tick      */2 * * * *    America/Guatemala
comicrent-cron-summary   */10 * * * *   America/Guatemala
```

Mostrar Pods generados:

```powershell
kubectl get pods -n sa-p5 |
  Select-String "cron"
```

Se observarán:

```text
Completed
```

---

# 23. Explicar Cron Tick

```text
Cada 2 minutos
      |
      v
fecha/hora GMT-6
+
carnet 202307705
      |
      v
operations_db
```

---

# 24. Explicar Cron Summary

```text
Cada 10 minutos
      |
      v
genera resumen
      |
      v
RabbitMQ
      |
      v
operations.hourly.summary
      |
      v
Summary Consumer
      |
      v
operations_db
```

En RabbitMQ UI puede abrirse:

```text
operations.hourly.summary
```

y mostrar:

```text
Durable = true
Consumers = 1
```

---

# 25. Mostrar configuración de CronJobs

```powershell
kubectl get cronjob comicrent-cron-tick -n sa-p5 -o yaml |
  Select-String `
  -Pattern "schedule:","timeZone:","concurrencyPolicy:","backoffLimit:","successfulJobsHistoryLimit:","failedJobsHistoryLimit:" `
  -Context 0,2
```

Repetir para:

```powershell
kubectl get cronjob comicrent-cron-summary -n sa-p5 -o yaml |
  Select-String `
  -Pattern "schedule:","timeZone:","concurrencyPolicy:","backoffLimit:","successfulJobsHistoryLimit:","failedJobsHistoryLimit:" `
  -Context 0,2
```

Mostrar:

```text
timeZone: America/Guatemala
concurrencyPolicy: Forbid
backoffLimit: 2
successfulJobsHistoryLimit: 3
failedJobsHistoryLimit: 3
```

---

# 26. Mostrar NetworkPolicies

```powershell
kubectl get networkpolicy -n sa-p5
```

Señalar:

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
```

### Qué decir

> El tráfico comienza bloqueado y cada workload recibe únicamente las excepciones necesarias.

Ejemplos permitidos:

```text
Gateway -> Auth
Gateway -> Comics
Gateway -> Rentals
Gateway -> Copies
Rentals -> Comics
Rentals -> Copies
Rentals -> RabbitMQ
Copies Consumer -> RabbitMQ/PostgreSQL
Summary Consumer -> RabbitMQ/PostgreSQL
```

Ejemplos bloqueados:

```text
Rentals -> Auth
Copies Service -> RabbitMQ
Summary Consumer -> Auth
```

La evidencia de timeouts se encuentra en:

```text
P5/evidence/Documentacion.md
```

---

# 27. Mostrar HPA

```powershell
kubectl get hpa -n sa-p5
```

Debe observarse:

```text
MINPODS = 1
MAXPODS = 2
TARGET CPU = 40%
```

### Qué decir

> El API Gateway escala horizontalmente desde una hasta dos réplicas cuando el uso promedio de CPU supera el 40%.

---

# 28. Archivo k6

El archivo se encuentra en:

```text
P5/load-test/gateway-health.js
```

Configuración actual:

```javascript
export const options = {
  stages: [
    { duration: '20s', target: 30 },
    { duration: '40s', target: 80 },
    { duration: '40s', target: 120 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1000'],
  },
};
```

---

# 29. Cómo interpretar los valores de k6

Cada etapa:

```javascript
{ duration: '40s', target: 80 }
```

significa:

```text
duration = cuánto tiempo dura la etapa
target   = cantidad objetivo de usuarios virtuales (VUs)
```

Ejemplo:

```javascript
{ duration: '20s', target: 30 }
```

k6 incrementa gradualmente hasta 30 VUs durante 20 segundos.

---

# 30. Ajustar la carga de k6

## Prueba ligera

Usar cuando solo se quiere comprobar que k6 funciona:

```javascript
stages: [
  { duration: '10s', target: 10 },
  { duration: '20s', target: 20 },
  { duration: '10s', target: 0 },
],
```

---

## Prueba media

Buena opción para una demostración rápida:

```javascript
stages: [
  { duration: '15s', target: 20 },
  { duration: '30s', target: 50 },
  { duration: '30s', target: 80 },
  { duration: '15s', target: 0 },
],
```

---

## Prueba utilizada en la evidencia final

```javascript
stages: [
  { duration: '20s', target: 30 },
  { duration: '40s', target: 80 },
  { duration: '40s', target: 120 },
  { duration: '20s', target: 0 },
],
```

Esta es la configuración recomendada para reproducir los resultados documentados.

---

## Prueba más agresiva

Solo utilizar si se necesita forzar el HPA y el equipo tiene recursos suficientes:

```javascript
stages: [
  { duration: '20s', target: 50 },
  { duration: '30s', target: 100 },
  { duration: '30s', target: 150 },
  { duration: '20s', target: 0 },
],
```

> No aumentar demasiado los VUs durante la calificación. Una carga excesiva puede saturar el entorno local y convertir una prueba de escalamiento en una prueba de fallo.

---

# 31. Ajustar thresholds de k6

Configuración actual:

```javascript
thresholds: {
  http_req_failed: ['rate<0.05'],
  http_req_duration: ['p(95)<1000'],
},
```

Esto significa:

```text
http_req_failed < 5%
p95 < 1000 ms
```

Para ser más estricto:

```javascript
thresholds: {
  http_req_failed: ['rate<0.01'],
  http_req_duration: ['p(95)<750'],
},
```

Interpretación:

```text
menos de 1% de errores
p95 menor a 750 ms
```

Para la evidencia ya obtenida no es necesario cambiar los thresholds.

---

# 32. Ejecutar k6

Primero comprobar que el Gateway sigue disponible:

```powershell
Invoke-WebRequest http://localhost:3100/health
```

Después:

```powershell
cd C:\Users\Vela\Desktop\SA\LAB\PRACTICAS\P5
```

Ejecutar:

```powershell
k6 run .\load-test\gateway-health.js
```

---

# 33. Observar HPA durante k6

En otra terminal:

```powershell
kubectl get hpa -n sa-p5 -w
```

Opcionalmente:

```powershell
kubectl get pods -n sa-p5 -w
```

Se espera observar:

```text
Gateway replicas
1
|
| CPU > 40%
v
2
```

---

# 34. Qué mostrar del resultado de k6

Al finalizar señalar:

```text
http_reqs
http_reqs/s
http_req_duration p(95)
http_req_failed
checks
vus_max
```

Resultados obtenidos en la prueba final:

```text
Solicitudes:      30,476
RPS:              253.86 req/s
p95:              536.72 ms
Tasa de error:    0.00 %
Checks exitosos:  100 %
Máximo VUs:       120
```

### Qué decir

> Durante la prueba el Gateway superó el objetivo de CPU del 40% y el HPA escaló de una a dos réplicas sin errores HTTP en la prueba final.

---

# 35. Si el HPA no escala inmediatamente

No modificar el HPA durante la evaluación.

Primero revisar:

```powershell
kubectl get hpa -n sa-p5
```

Después:

```powershell
kubectl top pods -n sa-p5
```

Si la CPU sigue debajo del 40%, aumentar progresivamente los VUs de k6.

Ejemplo:

```text
30 -> 80 -> 120
```

No saltar directamente a una carga extrema.

---

# 36. Mostrar PVC

```powershell
kubectl get pvc -n sa-p5
```

Resultado esperado:

```text
data-comicrent-postgresql-0   Bound   2Gi
data-comicrent-rabbitmq-0     Bound   1Gi
```

### Qué decir

> PostgreSQL y RabbitMQ utilizan almacenamiento persistente independiente del ciclo de vida de sus Pods.

---

# 37. Prueba de persistencia en vivo

Solo realizar si el evaluador la solicita.

Eliminar únicamente el Pod:

```powershell
kubectl delete pod comicrent-postgresql-0 -n sa-p5
```

Observar:

```powershell
kubectl get pods -n sa-p5 -w
```

El StatefulSet recreará:

```text
comicrent-postgresql-0
```

Cuando vuelva a `Running`, consultar datos previamente existentes.

> No eliminar el PVC.

---

# 38. Mostrar Service headless

```powershell
kubectl get svc -n sa-p5 `
  -o custom-columns="NAME:.metadata.name,CLUSTER-IP:.spec.clusterIP" |
  Select-String "postgres"
```

Resultado:

```text
comicrent-postgresql
comicrent-postgresql-hl   None
```

### Qué decir

> `ClusterIP None` confirma el Service headless asociado al StatefulSet.

---

# 39. Mostrar Probes

Copies Consumer:

```powershell
kubectl get deployment comicrent-copies-consumer -n sa-p5 `
  -o yaml |
  Select-String `
  -Pattern "startupProbe:","readinessProbe:","livenessProbe:" `
  -Context 0,9
```

Summary Consumer:

```powershell
kubectl get deployment comicrent-summary-consumer -n sa-p5 `
  -o yaml |
  Select-String `
  -Pattern "startupProbe:","readinessProbe:","livenessProbe:" `
  -Context 0,9
```

Explicar:

```text
startupProbe
-> controla el arranque.

readinessProbe
-> indica si está listo para trabajar.

livenessProbe
-> comprueba que el contenedor continúe saludable.
```

---

# 40. Mostrar RBAC

```powershell
kubectl get sa -n sa-p5
kubectl get role -n sa-p5
kubectl get rolebinding -n sa-p5
```

### Qué decir

> Cada workload principal utiliza una identidad dedicada mediante ServiceAccount, Role y RoleBinding.

---

# 41. Mostrar SecurityContext

```powershell
kubectl get deployment comicrent-api-gateway `
  -n sa-p5 `
  -o yaml |
  Select-String `
  -Pattern "runAsNonRoot","readOnlyRootFilesystem","allowPrivilegeEscalation" `
  -Context 0,2
```

Debe observarse:

```text
runAsNonRoot: true
readOnlyRootFilesystem: true
allowPrivilegeEscalation: false
```

También se utiliza:

```text
capabilities.drop = ALL
seccompProfile = RuntimeDefault
```

---

# 42. Mostrar ResourceQuota y LimitRange

```powershell
kubectl get resourcequota -n sa-p5
kubectl get limitrange -n sa-p5
```

### Qué decir

> ResourceQuota limita el consumo total del namespace y LimitRange define restricciones y valores por defecto para los contenedores.

---

# 43. Mostrar PDB

```powershell
kubectl get pdb -n sa-p5
```

Mostrar los principales:

```text
comicrent-api-gateway
comicrent-auth-service
comicrent-comics-service
comicrent-rentals-service
comicrent-copies-service
```

### Qué decir

> Con una réplica y `minAvailable: 1` es normal que `ALLOWED DISRUPTIONS` sea cero.

---

# 44. Mostrar RollingUpdate

```powershell
kubectl get deployment comicrent-api-gateway `
  -n sa-p5 `
  -o yaml |
  Select-String `
  -Pattern "maxUnavailable","maxSurge"
```

Debe mostrar:

```text
maxUnavailable: 0
maxSurge: 1
```

### Qué decir

> El nuevo Pod se crea y llega a Ready antes de retirar el anterior.

---

# 45. Mostrar evidencia de Zero Downtime

No repetir el upgrade salvo que lo soliciten.

Explicar:

> Se realizaron solicitudes continuas desde dentro del clúster contra el Service del Gateway mientras se ejecutaba un Helm upgrade. Durante todo el rollout las solicitudes respondieron HTTP 200.

La evidencia está en:

```text
P5/evidence/Documentacion.md
```

---

# 46. Mostrar rollback

```powershell
helm history comicrent
```

Señalar:

```text
Revision 8
Rollback to 6
```

No ejecutar rollback nuevamente salvo que lo soliciten.

Existe:

```text
P5/scripts/helm-rollback.ps1
```

---

# 47. Mostrar versionado

Abrir:

```text
P5/helm/comicrent/Chart.yaml
```

Mostrar:

```text
version: 0.2.0
appVersion: "1.1.0"
```

Explicar:

```text
0.1.0 / 1.0.0
        |
        v
0.2.0 / 1.1.0
```

---

# 48. Mostrar optimización de imágenes

Abrir:

```text
P5/evidence/Documentacion.md
```

Tabla:

| Servicio | Antes | Después |
|---|---:|---:|
| API Gateway | 497 MB Slim | 319 MB Alpine |
| Auth Service | 1.44 GB Slim | 1.33 GB Alpine |
| Comics Service | 1.53 GB Slim | 1.41 GB Alpine |
| Rentals Service | 293 MB Slim | 190 MB Alpine |
| Copies Service | 279 MB Slim | 176 MB Alpine |
| Operations Jobs | - | 94.7 MB Alpine |

---

# 49. Mostrar script de imágenes

El script es:

```text
P5/scripts/build-images.ps1
```

Registry:

```text
docker.io/davidvela777
```

Push:

```powershell
.\scripts\build-images.ps1 `
  -Tag "1.0.0" `
  -Registry "docker.io/davidvela777" `
  -Push
```

Carga local:

```powershell
.\scripts\build-images.ps1 `
  -Tag "1.0.0" `
  -LoadMinikube
```

---

# 50. Estado final

Después de las pruebas:

```powershell
kubectl get pods -n sa-p5
```

Los componentes principales deben seguir:

```text
Running
```

Y:

```powershell
helm status comicrent
```

Debe mostrar:

```text
STATUS: deployed
```

---

# 51. Pestañas recomendadas del navegador

Tener abiertas:

```text
1. Swagger
   http://localhost:3100/docs

2. RabbitMQ Management
   http://localhost:15672

3. Diagrama P5

4. GitHub P5

5. README.md

6. evidence/Documentacion.md
```

---

# 52. Orden corto para la demostración

Si el evaluador dice:

> "Muéstreme su práctica."

Seguir:

```text
1. Diagrama
2. minikube status
3. verify-cluster.ps1
4. helm lint
5. helm status
6. helm history
7. Port-forward Gateway
8. Port-forward RabbitMQ
9. Swagger
10. Login
11. Comics
12. Copies
13. Crear renta
14. RabbitMQ UI
15. Devolver renta
16. Consumer caído
17. RabbitMQ acumula mensaje
18. Recuperar consumer
19. CronJobs
20. NetworkPolicies
21. HPA
22. k6
23. PVC
24. Probes
25. RBAC / SecurityContext
26. PDB
27. RollingUpdate
28. Zero Downtime
29. History / Rollback / Versionado
30. Tabla de imágenes
31. Estado final
```

---

# 53. Pruebas seguras para hacer en vivo

Recomendadas:

```text
verify-cluster.ps1
helm lint
helm status
helm history
Swagger
RabbitMQ UI
flujo funcional
consumer-down y recuperación
CronJobs
NetworkPolicies
HPA
k6
PVC
probes
RBAC
PDB
```

---

# 54. Pruebas que solo deben realizarse si las solicitan

Evitar innecesariamente:

```text
helm rollback
helm upgrade
helm-version.ps1
eliminar PostgreSQL
eliminar PVC
eliminar namespace
eliminar Minikube
```

Ya existen evidencias para estas operaciones.

---

# 55. Checklist antes de calificar

- [ ] Docker Desktop iniciado.
- [ ] Minikube Running.
- [ ] Nodo Kubernetes Ready.
- [ ] Pods principales Running.
- [ ] PostgreSQL Running.
- [ ] RabbitMQ Running.
- [ ] PVC Bound.
- [ ] HPA activo.
- [ ] CronJobs activos.
- [ ] `helm status comicrent` = deployed.
- [ ] Gateway disponible en `localhost:3100`.
- [ ] Swagger abre en `localhost:3100/docs`.
- [ ] RabbitMQ UI abre en `localhost:15672`.
- [ ] Credencial de RabbitMQ puede recuperarse desde Secret.
- [ ] Usuario de prueba para Swagger disponible.
- [ ] Existe al menos un cómic.
- [ ] Existe al menos una copia disponible.
- [ ] k6 instalado.
- [ ] Diagrama abierto.
- [ ] README abierto.
- [ ] Documentacion.md abierto.
- [ ] GitHub abierto.
- [ ] No ejecutar rollback/upgrade sin necesidad.

---

# 56. Frases rápidas para defensa

## ¿Por qué RabbitMQ?

> Para desacoplar operaciones asíncronas. Si el consumer está detenido, RabbitMQ conserva el mensaje y lo entrega cuando vuelve.

## ¿Por qué existen llamadas Rentals -> Comics y Rentals -> Copies?

> Porque son necesarias para el flujo de negocio de una renta. Las NetworkPolicies permiten únicamente esas dependencias explícitas.

## ¿Cuándo se realiza ACK?

> Después de completar correctamente el procesamiento y confirmar la transacción en PostgreSQL.

## ¿Cómo se evita tráfico lateral no autorizado?

> Mediante `Default Deny` y NetworkPolicies específicas por workload.

## ¿Cómo escala el sistema?

> El Gateway utiliza HPA con mínimo 1, máximo 2 y objetivo de CPU del 40%.

## ¿Cómo se evita downtime?

> Con RollingUpdate usando `maxUnavailable: 0` y `maxSurge: 1`, además de readiness probes.

## ¿Cómo se mantiene la información?

> PostgreSQL y RabbitMQ utilizan StatefulSets y PVC persistentes.

## ¿Cómo se administra la aplicación?

> Mediante Helm 4, utilizando chart padre, subcharts, values, upgrade, history y rollback.

---

# 57. Cierre

Finalizar mostrando:

```powershell
kubectl get pods -n sa-p5
```

y:

```powershell
helm status comicrent
```

Resultado esperado:

```text
Pods principales: Running
Helm: deployed
```

Con esto se demuestra que el sistema continúa operativo después de las pruebas funcionales, asíncronas, de escalamiento, persistencia, seguridad y resiliencia.
