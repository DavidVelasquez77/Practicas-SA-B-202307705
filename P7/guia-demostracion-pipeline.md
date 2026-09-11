# Guía para demostrar el pipeline funcionando

Esta guía está pensada para la presentación en vivo ante el auxiliar. La idea es que vea una ejecución real de CI y otra de CD, desde GitHub Actions hasta GKE.

## 1. Preparar el entorno antes de iniciar

Para demostrar el `RollingUpdate` sin el problema de CPU de un solo nodo, usar temporalmente dos nodos durante la ejecución del CD:

```powershell
gcloud container clusters resize comicrent-gke-p6 `
  --node-pool=default-pool `
  --num-nodes=2 `
  --zone=us-central1-a `
  --project=comicrent-p6-2026
```

Esperar a que los dos nodos estén `Ready`:

```powershell
kubectl get nodes
```

Restaurar los workloads pausados:

```powershell
kubectl scale deployment --all -n sa-p6 --replicas=1
kubectl scale statefulset comicrent-rabbitmq -n sa-p6 --replicas=1

kubectl patch cronjob comicrent-cron-tick `
  -n sa-p6 --type=merge -p '{"spec":{"suspend":false}}'

kubectl patch cronjob comicrent-cron-summary `
  -n sa-p6 --type=merge -p '{"spec":{"suspend":false}}'

kubectl get pods -n sa-p6
```

No comenzar la demostración hasta que los servicios principales aparezcan `Running`.

## 2. Mostrar el punto de partida

Antes de crear una versión nueva, ejecutar:

```powershell
kubectl get deployments -n sa-p6 `
  -o custom-columns='NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image,STRATEGY:.spec.strategy.type'

helm history comicrent -n sa-p6 --max 5
```

Explicar al auxiliar:

> La versión desplegada actualmente es `v0.7.3`. Voy a crear un nuevo release `v0.7.4`; el pipeline construirá imágenes nuevas y Helm actualizará los Deployments mediante RollingUpdate.

## 3. Ejecutar CI en vivo

Para mostrar el disparador de Pull Request:

```powershell
git checkout main
git pull origin main
git checkout -b demo/p7-pipeline
```

Hacer un cambio pequeño y seguro, por ejemplo agregar una línea al README:

```powershell
Add-Content P7/README.md "`n<!-- Validación CI en vivo -->"
git add P7/README.md
git commit -m "docs(p7): ejecutar demostracion CI"
git push -u origin demo/p7-pipeline
```

En GitHub:

1. Abrir el enlace para crear el Pull Request.
2. Crear el PR hacia `main`.
3. Abrir **Actions → P7 CI**.
4. Mostrar que corren las matrices Node y Python.
5. Mostrar `TEST / Integraciones reales`.
6. Mostrar `TEST / Validación Helm P5 + P6 + P7`.
7. Esperar todos los checks verdes.

Decir:

> CI se ejecuta antes de aceptar el cambio. Si build, pruebas o Helm fallan, el cambio no puede avanzar hacia Dockerización ni despliegue.

Después del check verde, hacer merge del PR. El push resultante a `main` ejecutará nuevamente CI.

## 4. Crear el release para ejecutar CD

No reutilizar `v0.7.3`: los tags son inmutables. Después del merge, actualizar `main` y crear un tag nuevo:

```powershell
git checkout main
git pull origin main
git tag -a v0.7.4 -m "Release v0.7.4 - demostracion de CI/CD"
git push origin v0.7.4
```

Explicar:

> El tag `v0.7.4` activa CD. La variable `github.ref_name` toma ese valor y lo usa como tag de las imágenes GHCR y como tag de las imágenes que Helm despliega.

## 5. Mostrar CD en GitHub Actions

Abrir el workflow que se inició con el tag y mostrar las etapas en este orden:

1. **RELEASE / Validar tag** — confirma el formato `vX.Y.Z`.
2. **TEST** — reutiliza las validaciones de CI.
3. **DOCKERIZE / GHCR** — construye y publica seis imágenes.
4. **DEPLOY / GKE con OIDC** — obtiene credenciales de GCP, ejecuta Helm y valida el rollout.

Mientras el workflow corre, abrir GHCR y mostrar que aparecen los paquetes con tag `v0.7.4`:

```text
comicrent-api-gateway:v0.7.4
comicrent-auth-service:v0.7.4
comicrent-comics-service:v0.7.4
comicrent-rentals-service:v0.7.4
comicrent-copies-service:v0.7.4
comicrent-operations-jobs:v0.7.4
```

Mostrar que el job de GKE usa OIDC/WIF y no una llave JSON.

## 6. Verificar el cambio real en GKE

Cuando CD termine en verde, ejecutar:

```powershell
kubectl get deployments -n sa-p6 `
  -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,UPDATED:.status.updatedReplicas,AVAILABLE:.status.availableReplicas,STRATEGY:.spec.strategy.type,IMAGE:.spec.template.spec.containers[0].image'

kubectl get pods -n sa-p6 `
  -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[0].image,STATUS:.status.phase'

helm history comicrent -n sa-p6 --max 5
Invoke-RestMethod http://136.119.74.33:3000/health
```

La salida debe demostrar:

- Todas las Deployments están `1/1`.
- Las imágenes terminan en `:v0.7.4`.
- La estrategia es `RollingUpdate`.
- Helm tiene una revisión nueva en estado `deployed`.
- El health check responde `status: ok`.

Explicación para el auxiliar:

> El pipeline no solo terminó en verde: la imagen desplegada cambió de `v0.7.3` a `v0.7.4`, Helm creó los pods nuevos, esperó su disponibilidad y retiró los anteriores sin reemplazar todo el servicio de golpe.

## 7. Qué mostrar si pregunta por el fallo controlado

No provocar otro fallo durante la presentación. Abrir:

- `evidence/02-ci-failure-controlled.png`.
- `evidence/04-cd-blocked-by-tests.png`.

Explicar que una aserción se modificó intencionalmente, CI falló y `needs` impidió Dockerización y deploy. Después se restauró la prueba y se obtuvo el workflow verde.

## 8. Qué mostrar si pregunta por la separación CI/CD

Respuesta breve:

> CI corre continuamente en PR y `main` para detectar errores. CD solo corre con un tag de release, publica imágenes versionadas y modifica GKE. Así un commit de trabajo no se despliega automáticamente a producción.

## 9. Cerrar la demostración

Al finalizar, tomar o mostrar estas pruebas:

1. Workflow CI verde.
2. Workflow CD `v0.7.4` verde.
3. Paquetes GHCR con `v0.7.4`.
4. Helm revision nueva.
5. Deployments `1/1` con `RollingUpdate`.
6. Health pública en `status: ok`.

## 10. Apagar el entorno después de la calificación

Primero detener workloads y CronJobs para evitar que GKE se quede intentando reubicarlos:

```powershell
kubectl scale deployment --all -n sa-p6 --replicas=0
kubectl scale statefulset comicrent-rabbitmq -n sa-p6 --replicas=0
kubectl patch cronjob comicrent-cron-tick -n sa-p6 --type=merge -p '{"spec":{"suspend":true}}'
kubectl patch cronjob comicrent-cron-summary -n sa-p6 --type=merge -p '{"spec":{"suspend":true}}'
```

Después apagar los dos nodos:

```powershell
gcloud container clusters resize comicrent-gke-p6 `
  --node-pool=default-pool `
  --num-nodes=0 `
  --zone=us-central1-a `
  --project=comicrent-p6-2026
```

No borrar el clúster, el release Helm, los Secrets, las imágenes GHCR ni el PVC de RabbitMQ.

