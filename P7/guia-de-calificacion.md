# Guía de calificación — Práctica 7

Esta guía contiene el orden recomendado para presentar ComicRent al auxiliar. La demostración debe ser breve, ordenada y basada en las evidencias ya guardadas en `P7/evidence/`.

## 1. Antes de la demostración

El clúster quedó apagado en cero nodos para evitar consumo de créditos. Antes de la calificación, abrir PowerShell en el repositorio y ejecutar:

```powershell
gcloud container clusters resize comicrent-gke-p6 `
  --node-pool=default-pool `
  --num-nodes=1 `
  --zone=us-central1-a `
  --project=comicrent-p6-2026
```

Esperar hasta que el nodo aparezca como `Ready`:

```powershell
kubectl get nodes
```

Después restaurar los workloads que fueron pausados para ahorrar créditos:

```powershell
kubectl scale deployment --all -n sa-p6 --replicas=1
kubectl scale statefulset comicrent-rabbitmq -n sa-p6 --replicas=1

kubectl patch cronjob comicrent-cron-tick `
  -n sa-p6 --type=merge -p '{"spec":{"suspend":false}}'

kubectl patch cronjob comicrent-cron-summary `
  -n sa-p6 --type=merge -p '{"spec":{"suspend":false}}'
```

Comprobar que los servicios estén listos:

```powershell
kubectl get pods -n sa-p6
kubectl get deployments -n sa-p6
Invoke-RestMethod http://136.119.74.33:3000/health
```

La respuesta esperada del gateway es:

```json
{"service":"api-gateway","status":"ok"}
```

## 2. Presentar la estructura del repositorio

Mostrar brevemente que P7 no duplica el código de P4, P5 ni P6:

```text
.github/workflows/
├── p7-ci.yml
└── p7-cd.yml

P7/
├── README.md
├── guia-de-calificacion.md
├── config/
├── diagrams/
└── evidence/
```

Explicar:

> P4 conserva el código y las pruebas, P5 conserva Helm, P6 conserva la configuración de GKE y P7 agrega la automatización CI/CD, el diagrama, los overrides y las evidencias.

Abrir [README.md](README.md) y mostrar el diagrama [ComicRent - CI_CD Pipeline.png](diagrams/ComicRent%20-%20CI_CD%20Pipeline.png).

## 3. Explicar el flujo general

Mostrar el diagrama de izquierda a derecha:

```text
Commit o Pull Request
        ↓
GitHub Actions — CI
        ↓
Build + Test
        ↓
Tag vX.Y.Z
        ↓
Dockerización y publicación en GHCR
        ↓
OIDC + Workload Identity Federation
        ↓
Helm upgrade en GKE
        ↓
RollingUpdate + health check
```

La explicación debe mencionar las cuatro fases solicitadas:

1. **Build:** instala dependencias y compila los servicios Node y Python.
2. **Test:** ejecuta 11 pruebas unitarias, 3 integraciones reales y validación Helm.
3. **Dockerización:** construye seis imágenes y las publica en GitHub Container Registry.
4. **Despliegue:** autentica contra GCP con OIDC/WIF y ejecuta `helm upgrade` en GKE.

## 4. Mostrar CI

Abrir `.github/workflows/p7-ci.yml` y explicar que se ejecuta en:

- Pull Requests.
- Push a `main`.
- Ejecución reutilizable desde CD.

En GitHub Actions abrir el workflow verde de CI y mostrar:

- Matriz Node: `api-gateway`, `auth-service` y `comics-service`.
- Matriz Python: `rentals-service`, `copies-service` y `operations-jobs`.
- Pruebas de integración entre Rentals y Comics.
- Pruebas de integración entre Rentals y Copies.
- Flujo RabbitMQ `copy.return.requested` y su consumidor.
- Validación del chart Helm de P5 y los valores de GKE de P6.

Abrir la captura `evidence/08-ci-success.png`. Los nombres de las etapas aparecen como `BUILD + TEST` y `TEST / Integraciones reales`, y cada prueba muestra su resultado `PASSED`.

## 5. Mostrar el fallo controlado

Abrir estas evidencias, sin volver a romper el repositorio durante la evaluación:

1. `evidence/02-ci-failure-controlled.png`.
2. `evidence/03-auth-controlled-assertion.png`.
3. `evidence/04-cd-blocked-by-tests.png`.

Explicar:

> Se provocó un fallo controlado en una aserción. CI se puso en rojo y, debido a `needs`, las etapas posteriores de Dockerización y despliegue no se ejecutaron. Después se corrigió la aserción y se obtuvo nuevamente un workflow verde.

Esto demuestra que el pipeline no publica ni despliega una versión que no pasó las pruebas.

## 6. Mostrar CD y GHCR

Abrir `.github/workflows/p7-cd.yml` y mostrar que el disparador es:

```yaml
on:
  push:
    tags: ['v*']
```

Explicar que el tag se convierte en la versión de las imágenes:

```yaml
RELEASE_TAG: ${{ github.ref_name }}
```

Para la ejecución validada se utilizó:

```text
v0.7.3
```

Abrir la evidencia `evidence/09-ghcr-packages.png` y mostrar las seis imágenes:

```text
comicrent-api-gateway:v0.7.3
comicrent-auth-service:v0.7.3
comicrent-comics-service:v0.7.3
comicrent-rentals-service:v0.7.3
comicrent-copies-service:v0.7.3
comicrent-operations-jobs:v0.7.3
```

Mostrar también la ejecución [CD verde de v0.7.3](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34297527796). Explicar que Dockerización depende de los tests y Deploy depende de Dockerización.

## 7. Explicar OIDC, WIF y GKE

Abrir:

- `evidence/05-gcp-wif-provider.png`.
- `evidence/06-gcp-wif-service-account.png`.
- `evidence/07-cd-success.png`.

Explicar el flujo:

```text
GitHub Actions
      ↓ OIDC
Workload Identity Federation
      ↓
Service Account de GCP
      ↓
Credenciales temporales para GKE
```

Puntos importantes:

- No se utiliza una llave JSON estática.
- GitHub recibe credenciales temporales.
- La confianza está restringida al repositorio y workflow configurados.
- El pipeline obtiene credenciales del clúster y ejecuta Helm.

## 8. Demostrar el cambio de imagen y RollingUpdate

Abrir `evidence/gke-final-verification.log` y mostrar que Helm llegó a la revisión 3 y que las imágenes cambiaron de `v0.7.2` a `v0.7.3`.

Si el nodo está activo, ejecutar:

```powershell
kubectl get pods -n sa-p6 `
  -o custom-columns='NAME:.metadata.name,IMAGE:.spec.containers[0].image,STATUS:.status.phase'

kubectl get deployments -n sa-p6 `
  -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,UPDATED:.status.updatedReplicas,AVAILABLE:.status.availableReplicas,STRATEGY:.spec.strategy.type,IMAGE:.spec.template.spec.containers[0].image'

helm history comicrent -n sa-p6 --max 5
```

La evidencia debe mostrar:

- Siete Deployments `1/1`.
- Imágenes GHCR terminadas en `:v0.7.3`.
- Estrategia `RollingUpdate`.
- Helm revision 3 en estado `deployed`.
- Pods antiguos reemplazados por pods nuevos.

Explicación corta:

> Kubernetes crea el pod de la nueva versión, espera que esté saludable y luego retira el pod anterior. Así el cambio de `v0.7.2` a `v0.7.3` se realiza de forma controlada.

## 9. Respuestas para preguntas teóricas

**¿Por qué existen dos workflows?**

CI se ejecuta frecuentemente en Pull Requests y en `main` para detectar errores. CD se reserva para tags de release, publica imágenes y modifica GKE. Separarlos evita desplegar cada commit.

**¿Por qué no hay pruebas E2E?**

ComicRent no tiene interfaz gráfica. La estrategia se concentra en 11 unitarias y 3 integraciones/API, que cubren la lógica y la comunicación entre microservicios.

**¿Por qué usar tags?**

El tag identifica una versión inmutable, por ejemplo `v0.7.3`. El workflow usa ese mismo valor en GHCR y Helm, lo que permite rastrear y repetir un despliegue.

**¿Por qué GHCR?**

Está integrado con GitHub Actions y permite publicar las imágenes usando `GITHUB_TOKEN` con `packages: write`.

**¿Por qué WIF en lugar de una llave JSON?**

WIF usa credenciales temporales y evita almacenar una llave permanente en GitHub.

**¿Qué hace `--atomic`?**

Si el upgrade falla, Helm intenta regresar a la revisión anterior. No revierte cambios destructivos en datos.

## 10. Cierre de la presentación

Cerrar mostrando:

1. Workflow CI verde.
2. Workflow CD verde.
3. Imágenes `v0.7.3` en GHCR.
4. Helm revision 3.
5. Pods `Running` y estrategia `RollingUpdate`.
6. Health pública del gateway.
7. Documentación y evidencias dentro de `P7/`.

Frase final sugerida:

> La Práctica 7 automatiza desde el commit hasta el despliegue versionado en GKE. Cada release pasa build, pruebas, Dockerización, publicación en GHCR y despliegue con Helm mediante OIDC/WIF, con evidencia del cambio de imagen y del RollingUpdate.

## 11. Después de la calificación

Para evitar consumo de créditos, volver a pausar los workloads y bajar el pool a cero siguiendo la sección de pausa del [README de P7](README.md). No reutilizar `v0.7.3` para otro commit; si se necesita una nueva ejecución de CD, usar un tag nuevo como `v0.7.4`.
