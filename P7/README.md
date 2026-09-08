# Práctica 7 — Manual técnico CI/CD de ComicRent

## 1. Propósito y alcance

Esta práctica automatiza la entrega del sistema de microservicios construido en P4, P5 y P6. El flujo implementa las cuatro fases solicitadas:

```text
Build → Test → Dockerización → Despliegue
```

P7 agrega únicamente la automatización, la configuración específica, el diagrama, las evidencias y este manual. El código de P4, el chart de P5 y la configuración GKE de P6 se reutilizan desde sus ubicaciones originales.

Resultado validado: el release `v0.7.2` pasó CI/CD, publicó seis imágenes en GHCR y quedó desplegado en GKE mediante GitHub OIDC + Google Workload Identity Federation. El gateway responde en [http://136.119.74.33:3000/health](http://136.119.74.33:3000/health).

## 2. Arquitectura y datos del entorno

![Pipeline de P7](diagrams/pipeline.svg)

| Elemento | Valor |
| --- | --- |
| Repositorio | `DavidVelasquez77/Practicas-SA-B-202307705` |
| Proyecto GCP | `comicrent-p6-2026` |
| Clúster / zona | `comicrent-gke-p6` / `us-central1-a` |
| Node pool | `default-pool` |
| Namespace | `sa-p6` |
| Release Helm | `comicrent` |
| Registry | `ghcr.io/davidvelasquez77` |
| Versión validada | `v0.7.2` |

Los workflows son:

- `.github/workflows/p7-ci.yml`: corre en Pull Request, push a `main` o como workflow reutilizable. Compila Node y Python, ejecuta 11 unitarias, 3 integraciones y Helm.
- `.github/workflows/p7-cd.yml`: corre con tags `vX.Y.Z`. Reutiliza CI, construye seis imágenes, las publica, autentica contra GCP con OIDC/WIF y ejecuta `P7/config/deploy.sh`.

La dependencia `needs` impide dockerizar si fallan las pruebas y también impide desplegar si falla la dockerización. La concurrencia `p7-production` evita dos upgrades de Helm simultáneos.

## 3. Organización del repositorio

```text
P7/
├── README.md
├── config/
│   ├── deploy.sh
│   ├── setup-wif.ps1
│   ├── values-ci-cd.yaml
│   └── wif-access.yaml
├── diagrams/
│   ├── pipeline.mmd
│   └── pipeline.svg
└── evidence/
```

P4, P5 y P6 no se copian dentro de P7. Los workflows apuntan directamente a `P4/...`, `P5/...` y `P6/...`.

## 4. Requisitos previos

Para reproducir la validación local se necesita Git, Node.js 22, npm, Python 3.12, Docker Desktop con Compose y Helm 3.17 o compatible. Para desplegar se requieren `gcloud`, `kubectl` y `gke-gcloud-auth-plugin`.

No se deben copiar archivos `.env`, tokens, llaves JSON ni secretos de P6 al repositorio. El despliegue reutiliza los Secrets que ya existen en `sa-p6`.

## 5. Validación local

Ejecutar desde la raíz `C:\Users\Vela\Desktop\SA\LAB\PRACTICAS`.

### 5.1 Servicios Node

```powershell
cd P4/api-gateway
npm ci
npm run build
npm test -- --runInBand

cd ..\services\auth-service
npm ci
$env:DATABASE_URL='postgresql://test:test@localhost:5432/test'
npx --no-install prisma generate
npm run build
npm test

cd ..\comics-service
npm ci
$env:DATABASE_URL='postgresql://test:test@localhost:5432/test'
npx --no-install prisma generate
npm run build
npm test -- --runInBand
```

`DATABASE_URL` es sintética y solo se usa para generar Prisma; no conecta a producción.

### 5.2 Servicios Python y CronJob

```powershell
cd P4/services/rentals-service
python -m pip install -r requirements.txt
python -m compileall -q app
python -m unittest discover -s tests -p 'test_*.py' -v

cd ..\copies-service
python -m pip install -r requirements.txt
python -m compileall -q app
python -m unittest discover -s tests -p 'test_*.py' -v

cd ..\..\..\P5\jobs
python -m pip install -r requirements.txt
python -m compileall -q .
python -m unittest discover -s tests -p 'test_*.py' -v
```

### 5.3 Tres integraciones reales

Con Docker Desktop activo:

```powershell
docker compose -p comicrent-p7-tests -f P4/tests/integration/compose.yaml build
docker compose -p comicrent-p7-tests -f P4/tests/integration/compose.yaml up --abort-on-container-exit --exit-code-from tests
docker compose -p comicrent-p7-tests -f P4/tests/integration/compose.yaml down --volumes --remove-orphans
```

Se comprueban Rentals–Comics mediante GraphQL, Rentals–Copies mediante HTTP/persistencia y el evento RabbitMQ `copy.return.requested` con su consumidor real.

### 5.4 Helm

```powershell
helm lint P5/helm/comicrent -f P6/k8s/values-gke-prod.yaml -f P7/config/values-ci-cd.yaml
helm template comicrent P5/helm/comicrent --namespace sa-p6 -f P6/k8s/values-gke-prod.yaml -f P7/config/values-ci-cd.yaml > p7-rendered.yaml
```

El valor `must-set-release-tag` es un guardia intencional; CD lo reemplaza por el tag real.

## 6. Pruebas implementadas

| Grupo | Casos | Herramienta |
| --- | ---: | --- |
| api-gateway | 2 | Jest |
| auth-service | 2 | Node test runner |
| comics-service | 2 | Jest |
| rentals-service | 2 | `unittest` |
| copies-service | 2 | `unittest` |
| CronJob de P5 | 1 | `unittest` |
| Integración | 3 | Docker Compose, PostgreSQL y RabbitMQ |

Total: 11 unitarias y 3 integraciones. La proporción es 78.6% / 21.4%; no se implementan pruebas UI porque ComicRent no tiene interfaz gráfica.

## 7. GHCR y versionamiento

CD publica:

```text
ghcr.io/davidvelasquez77/comicrent-api-gateway:vX.Y.Z
ghcr.io/davidvelasquez77/comicrent-auth-service:vX.Y.Z
ghcr.io/davidvelasquez77/comicrent-comics-service:vX.Y.Z
ghcr.io/davidvelasquez77/comicrent-rentals-service:vX.Y.Z
ghcr.io/davidvelasquez77/comicrent-copies-service:vX.Y.Z
ghcr.io/davidvelasquez77/comicrent-operations-jobs:vX.Y.Z
```

Cada imagen también recibe `sha-COMMIT_COMPLETO`. El login usa `GITHUB_TOKEN` con `packages: write`; no se almacena un PAT manual. Los paquetes son públicos para que GKE los descargue sin `imagePullSecret`.

## 8. OIDC y Workload Identity Federation

GitHub emite un token OIDC de corta duración; GCP lo valida mediante el provider y entrega credenciales temporales a la Service Account. No se usa una llave JSON.

```text
Pool: github-p7
Provider: github
Service Account: github-p7-deployer@comicrent-p6-2026.iam.gserviceaccount.com
Provider resource: projects/950813313175/locations/global/workloadIdentityPools/github-p7/providers/github
```

Con una cuenta GCP autorizada, la configuración reproducible es:

```powershell
gcloud auth login
gcloud config set project comicrent-p6-2026
& .\P7\config\setup-wif.ps1
```

El script crea o valida el pool, provider, Service Account, binding de identidad y RBAC limitado a `sa-p6`. No genera llaves ni escala nodos.

En GitHub abrir **Settings → Secrets and variables → Actions → Variables** y crear:

| Variable | Valor |
| --- | --- |
| `GCP_WIF_PROVIDER` | `projects/950813313175/locations/global/workloadIdentityPools/github-p7/providers/github` |
| `GCP_SERVICE_ACCOUNT` | `github-p7-deployer@comicrent-p6-2026.iam.gserviceaccount.com` |

Son identificadores de recursos, no secretos. No guardar tokens ni llaves en Variables, capturas o commits.

## 9. Despliegue en GKE

P7 reutiliza el clúster existente y no lo recrea. Antes de evaluar un tag, subir el pool:

```powershell
gcloud container clusters resize comicrent-gke-p6 --node-pool=default-pool --num-nodes=1 --zone=us-central1-a --project=comicrent-p6-2026
```

Comprobar acceso:

```powershell
gcloud container clusters get-credentials comicrent-gke-p6 --zone=us-central1-a --project=comicrent-p6-2026
kubectl get nodes
kubectl get pods -n sa-p6
helm history comicrent -n sa-p6
```

Crear un release desde `main`:

```powershell
git checkout main
git pull
git tag vX.Y.Z
git push origin vX.Y.Z
```

El tag dispara CD. El job comprueba el nodo `Ready`, Secrets existentes, StorageClass, RabbitMQ y kube-dns; luego ejecuta el upgrade Helm con `--atomic --wait --timeout 15m`. Finalmente valida rollouts, versión de imágenes, CronJobs, RabbitMQ, Helm history y `/health`.

No se debe reutilizar un tag para otro commit. Al terminar la evaluación, se puede volver a cero nodos:

```powershell
gcloud container clusters resize comicrent-gke-p6 --node-pool=default-pool --num-nodes=0 --zone=us-central1-a --project=comicrent-p6-2026
```

## 10. Fallos y recuperación

- Si falla una prueba, CI termina en rojo y Docker/deploy quedan omitidos.
- Si una imagen GHCR es privada, CD falla antes de tocar GKE; hacer público el paquete y reintentar.
- Si no hay nodo `Ready`, subir `default-pool` a 1 y esperar.
- Si Helm falla durante el upgrade, `--atomic` intenta rollback. No revierte automáticamente cambios destructivos de datos.
- Si falla el health público, revisar `kubectl get pods -n sa-p6`, `kubectl describe` y logs antes de reintentar.

No borrar el clúster, Secrets ni PVC de P6 como método de recuperación.

## 11. Evidencias y resultado validado

| Evidencia | Archivo |
| --- | --- |
| Variables de Actions | `evidence/01-actions-variables.png` |
| Fallo controlado y CD bloqueado | `evidence/02-ci-failure-controlled.png`, `04-cd-blocked-by-tests.png` |
| WIF / Service Account | `evidence/05-gcp-wif-provider.png`, `06-gcp-wif-service-account.png` |
| CI y CD verdes | `evidence/08-ci-success.png`, `07-cd-success.png` |
| Paquetes GHCR | `evidence/09-ghcr-packages.png` |
| Verificación GKE/Helm/health | `evidence/gke-final-verification.log` |

### Galería visual de la ejecución

#### Variables de GitHub Actions y fallo controlado

![Variables de Actions](evidence/01-actions-variables.png)

![Fallo controlado en CI](evidence/02-ci-failure-controlled.png)

![Aserción modificada para provocar el fallo](evidence/03-auth-controlled-assertion.png)

![CD detenido porque fallaron las pruebas](evidence/04-cd-blocked-by-tests.png)

#### Identidad cloud y publicación de imágenes

![Provider OIDC de GCP](evidence/05-gcp-wif-provider.png)

![Service Account de despliegue](evidence/06-gcp-wif-service-account.png)

![Paquetes públicos publicados en GHCR](evidence/09-ghcr-packages.png)

#### Workflows exitosos

![CI exitoso con build, pruebas e integraciones](evidence/08-ci-success.png)

![CD exitoso con dockerización y despliegue GKE](evidence/07-cd-success.png)

Ejecuciones:

- [CI verde de main](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34274196000)
- [CD verde de v0.7.2](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34274200611)
- [CI final documental](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34278748090)
- [Fallo controlado](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34271159061)
- [CD bloqueado por tests](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34273962993)

El release `v0.7.2` dejó Helm en revisión 2 (`deployed`, `Upgrade complete`), un nodo `Ready`, siete Deployments `1/1`, RabbitMQ `1/1` y el endpoint público respondiendo `{"service":"api-gateway","status":"ok"}`.

## 12. Preguntas teóricas

**¿Qué diferencia existe entre CI y CD?** CI valida cada cambio con build y pruebas. CD toma un release validado, publica imágenes y actualiza GKE.

**¿Por qué Docker y deploy dependen de tests?** Un build correcto no garantiza comportamiento correcto. `needs` evita publicar o desplegar una versión que no pasó las pruebas.

**¿Por qué usar tags y SHA?** El tag identifica la versión evaluada y el SHA permite relacionarla con un commit exacto y repetir un rollback.

**¿Por qué WIF en vez de una llave JSON?** WIF entrega credenciales temporales y restringidas por repositorio/workflow, sin almacenar una llave permanente en GitHub.

**¿Qué detectan las integraciones?** Detectan fallos de contratos GraphQL/HTTP, persistencia y mensajería que una prueba unitaria aislada no puede descubrir.

**¿Qué límites tiene `--atomic`?** Helm revierte recursos del upgrade fallido, pero no deshace automáticamente cambios destructivos en datos.

## Referencias

- Enunciado oficial: `0780_Practica_7_2S2026.md`.
- [GitHub Actions](https://docs.github.com/es/actions)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Google Auth para GitHub Actions](https://github.com/google-github-actions/auth)
- [Credenciales GKE para Actions](https://github.com/google-github-actions/get-gke-credentials)
- [Workload Identity Federation](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
