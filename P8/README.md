# Práctica 8 — GitOps, entrega Canary y seguridad de la cadena de suministro

## Objetivo

ComicRent evoluciona el CI/CD de P7 hacia GitOps. GitHub Actions valida el código, construye y firma imágenes en GHCR y abre un Pull Request en el repositorio GitOps. ArgoCD es el único componente que aplica los manifiestos al clúster; Argo Rollouts promueve la versión con estrategia Canary y revierte automáticamente si el análisis falla.

## Flujo implementado

1. `p8-ci.yml` ejecuta build, pruebas unitarias, integraciones, Helm lint, Terraform validate y Trivy en Pull Requests y `main`.
2. `p8-release.yml` se activa con tags SemVer `vX.Y.Z`, construye las seis imágenes, genera SBOM, firma con Cosign y abre un Pull Request al repositorio GitOps.
3. Después del merge del Pull Request GitOps, ArgoCD sincroniza la aplicación `comicrent-p8` desde `main`.
4. Argo Rollouts entrega `api-gateway` mediante Canary: 10% → 25% → 50% → 100%. Cada etapa ejecuta el `AnalysisTemplate` `api-gateway-smoke` con k6.
5. Una versión defectuosa produce un análisis fallido y un rollback automático.

## Estado de validación del despliegue

La validación en GKE se realizó el 14 de septiembre de 2026 después de integrar los últimos cambios del repositorio GitOps:

- ArgoCD `comicrent-p8`: `Synced` y `Healthy`.
- Argo Rollout `comicrent-api-gateway-rollout`: `Healthy`, paso actual `10`, estable `7fb647ddcc`.
- RabbitMQ `comicrent-rabbitmq-0`: `1/1 Running`.
- `copies-consumer` y `summary-consumer`: `1/1 Running`.
- CronJobs `comicrent-cron-tick` y `comicrent-cron-summary`: activos, sin ejecuciones pendientes.
- `helm lint P8/charts/comicrent -f P8/config/values-gke.yaml`: correcto.

Los detalles de la comprobación y los comandos reproducibles están en [`evidence/live-validation-2026-09-14.txt`](evidence/live-validation-2026-09-14.txt). Los archivos de evidencia visual se conservan separados para agregar capturas de GitHub Actions, ArgoCD y el clúster sin incluir credenciales.

## Repositorios y componentes

| Elemento | Valor |
|---|---|
| Código | `DavidVelasquez77/Practicas-SA-B-202307705` |
| GitOps | `https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops` |
| ArgoCD namespace | `argocd` |
| ArgoCD Application | `comicrent-p8` en `argocd` |
| Namespace de aplicación | `sa-p8` |
| Registry | `ghcr.io/davidvelasquez77` |
| Clúster | `comicrent-gke-p6` / `us-central1-a` |

## Seguridad

- No hay kubeconfig ni comandos `kubectl apply`, `kubectl set image` o `helm upgrade` en los workflows de P8.
- Trivy bloquea imágenes con vulnerabilidades CRITICAL.
- Cada imagen publica su SBOM y se firma con Cosign usando la identidad OIDC de GitHub Actions.
- Kyverno aplica las políticas `p8-disallow-latest`, `p8-require-resources` y `p8-require-nonroot`.
- Los secretos reales no se guardan en GitOps. Sealed Secrets se utiliza para representar los valores cifrados.

## Evidencias requeridas

- CI exitoso: `[pendiente de run]`
- Release y Pull Request GitOps: `[pendiente de run]`
- ArgoCD Synced/Healthy: `evidence/argocd-synced-healthy.png`
- Promoción Canary: `evidence/canary-promotion.png`
- Rollback automático: `evidence/canary-rollback.png`
- Trivy bloqueando una imagen defectuosa: `evidence/trivy-blocked.png`
- Política Kyverno rechazando un manifiesto: `evidence/kyverno-rejected.png`
- SBOM y verificación Cosign: `evidence/supply-chain.txt`
- Reporte de carga k6: `evidence/k6-summary.json`

## Incidente controlado

La versión defectuosa se publica con una respuesta no saludable en `/health`. El `AnalysisTemplate` detecta el error durante el primer paso Canary, detiene la promoción, mantiene el tráfico en la versión estable y Argo Rollouts revierte la nueva ReplicaSet. El informe completo está en [`docs/incident-report.md`](docs/incident-report.md).
