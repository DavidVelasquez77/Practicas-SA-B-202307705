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
- ArgoCD `comicrent-p8-policies`: `Synced` y `Healthy`; las cuatro políticas Kyverno están en `Enforce`.
- Argo Rollout `comicrent-api-gateway-rollout`: `Healthy`, paso actual `10`, estable `7fb647ddcc`.
- RabbitMQ `comicrent-rabbitmq-0`: `1/1 Running`.
- `copies-consumer` y `summary-consumer`: `1/1 Running`.
- CronJobs `comicrent-cron-tick` y `comicrent-cron-summary`: activos, sin ejecuciones pendientes.
- `helm lint P8/charts/comicrent -f P8/config/values-gke.yaml`: correcto.

Los detalles de la comprobación y los comandos reproducibles están en [`evidence/live-validation-2026-09-14.txt`](evidence/live-validation-2026-09-14.txt). Las evidencias textuales adicionales no contienen credenciales y se pueden revisar directamente desde el repositorio.

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
- Kyverno aplica en `Enforce` las políticas `p8-disallow-latest`, `p8-require-resources`, `p8-require-nonroot` y `p8-verify-cosign`.
- Terraform administra namespaces, cuotas, límites y RBAC; GitOps administra las políticas Kyverno y los manifiestos de la aplicación.
- Los secretos no se guardan en texto plano: GitOps versiona recursos `SealedSecret` con `encryptedData` y ArgoCD aplica los Secrets generados en `sa-p8`.

## Tabla de enlaces de entrega

| Evidencia | Enlace |
|---|---|
| Repositorio de código | [Practicas-SA-B-202307705](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705) |
| Repositorio GitOps | [Practicas-SA-B-202307705-gitops](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops) |
| CI exitoso | [Actions run 34908240306](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34908240306) |
| Release, SBOM, Trivy y Cosign | [Actions run 34898901057](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34898901057) |
| PR de políticas Cosign y drift ArgoCD | [GitOps PR #11](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/11) y [PR #15](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/15) |
| Rollback Canary | [PR de prueba #12](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/12) y [restauración #13](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/13) |
| ArgoCD y políticas | [`argocd-synced-healthy.txt`](evidence/argocd-synced-healthy.txt) y [`policies-active.txt`](evidence/policies-active.txt) |
| Rechazo de imagen no firmada | [`kyverno-cosign-rejected.txt`](evidence/kyverno-cosign-rejected.txt) |
| Imagen firmada de referencia | `ghcr.io/davidvelasquez77/comicrent-api-gateway:v0.8.4` |
| Terraform | [`terraform-validation.txt`](evidence/terraform-validation.txt) |
| k6 y umbrales | [`k6-summary.json`](evidence/k6-summary.json) |
| Informe del incidente | [`docs/incident-report.md`](docs/incident-report.md) |
| Video de entrega | Pendiente de grabar |

El `README` del repositorio GitOps contiene también la descripción operativa de ArgoCD, Rollouts, políticas y secretos sellados.

## Incidente controlado

La prueba controlada cambió temporalmente el endpoint del smoke test a una ruta inexistente. El `AnalysisTemplate` detectó el error durante el primer paso Canary, detuvo la promoción, mantuvo el tráfico en la versión estable y Argo Rollouts abortó la revisión nueva. La configuración sana se restauró mediante una PR posterior. El informe completo está en [`docs/incident-report.md`](docs/incident-report.md).
