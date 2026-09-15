# Práctica 8 — GitOps, entrega Canary y seguridad de la cadena de suministro

## Objetivo

ComicRent evoluciona el CI/CD de P7 hacia GitOps. GitHub Actions valida el código, construye y firma imágenes en GHCR y abre un Pull Request en el repositorio GitOps. ArgoCD es el único componente que aplica los manifiestos al clúster; Argo Rollouts promueve la versión con estrategia Canary y revierte automáticamente si el análisis falla.

Toda la plataforma se levanta desde Terraform: GKE, node pool, namespaces, cuotas,
límites, RBAC, ArgoCD, Argo Rollouts, Kyverno, Sealed Secrets, las políticas y el
bootstrap de la única aplicación `comicrent-p8`. Terraform no instala el chart de
ComicRent; crea el `Application` y ArgoCD lo sincroniza desde el repositorio GitOps.

## Flujo implementado

1. `p8-ci.yml` ejecuta build, pruebas unitarias, integraciones, Helm lint, Terraform validate y Trivy en Pull Requests y `main`.
2. `p8-release.yml` se activa con tags SemVer `vX.Y.Z`, construye las seis imágenes, genera SBOM, firma con Cosign y abre un Pull Request al repositorio GitOps.
3. Después del merge del Pull Request GitOps, la única aplicación de ArgoCD, `comicrent-p8`, sincroniza `apps/comicrent` desde `main`.
4. Argo Rollouts entrega `api-gateway` mediante Canary: 10% → 25% → 50% → 100%. Cada etapa ejecuta el `AnalysisTemplate` `api-gateway-smoke` con k6.
5. Una versión defectuosa produce un análisis fallido y un rollback automático.

## Estado de validación del despliegue

La validación final en GKE se realizó el 14–15 de septiembre de 2026 después de integrar los últimos cambios del repositorio GitOps:

- ArgoCD `comicrent-p8`: `Synced` y `Healthy`.
- Solo existe la aplicación ArgoCD `comicrent-p8`; las cuatro políticas pertenecen al release Terraform `p8-platform-bootstrap` y están en `Enforce`.
- Argo Rollout `comicrent-api-gateway-rollout`: `Healthy`, paso actual `10`, revisión actual y estable `696d66b484`.
- RabbitMQ `comicrent-rabbitmq-0`: `1/1 Running`.
- `copies-consumer` y `summary-consumer`: `1/1 Running`.
- CronJobs `comicrent-cron-tick` y `comicrent-cron-summary`: activos, sin ejecuciones pendientes.
- `helm lint P8/charts/comicrent -f P8/config/values-gke.yaml`: correcto.
- La validación live se realizó después de reconstruir el clúster desde estado vacío.

Los detalles de la comprobación y los comandos reproducibles están en [`evidence/live-validation-2026-09-15.txt`](evidence/live-validation-2026-09-15.txt). Las evidencias textuales adicionales no contienen credenciales y se pueden revisar directamente desde el repositorio.

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

## Documentación y evidencias visuales

- [Documentación técnica](docs/technical-documentation.md): flujo GitOps, validaciones y decisiones de diseño.
- [Informe de incidente](docs/incident-report.md): fallo inducido y rollback automático en una página.
- [Diagrama del flujo](diagrams/p8-gitops-pipeline.png)
- [Estado live validado](diagrams/p8-live-validation.png)
- [Flujo de rollback](diagrams/p8-canary-rollback.png)

## Seguridad

- No hay kubeconfig ni comandos `kubectl apply`, `kubectl set image` o `helm upgrade` en los workflows de P8.
- Trivy bloquea imágenes con vulnerabilidades CRITICAL.
- Cada imagen publica su SBOM y se firma con Cosign usando la identidad OIDC de GitHub Actions.
- Kyverno aplica en `Enforce` las políticas `p8-disallow-latest`, `p8-require-resources`, `p8-require-nonroot` y `p8-verify-cosign`.
- Terraform administra GKE, el node pool, namespaces, cuotas, límites, RBAC, los controladores, las políticas Kyverno y el bootstrap de ArgoCD.
- El repositorio GitOps contiene únicamente el chart y los secretos sellados de la aplicación; no contiene workflows.
- Los secretos no se guardan en texto plano: GitOps versiona recursos `SealedSecret` con `encryptedData` y ArgoCD aplica los Secrets generados en `sa-p8`.

## Construcción desde cero

Después de autenticar Google Application Default Credentials y ejecutar una vez
`terraform init`, el despliegue completo se realiza con:

```bash
cd P8/terraform
terraform apply
```

El mismo estado permite ejecutar `terraform destroy` y posteriormente
`terraform apply`. La clave de recuperación de Sealed Secrets permanece en
`~/.comicrent/p8-sealed-secrets/`, fuera de Git, para que los `encryptedData` del
repositorio sigan siendo descifrables después de reconstruir el clúster.

## Tabla de enlaces de entrega

| Evidencia | Enlace |
|---|---|
| Repositorio de código | [Practicas-SA-B-202307705](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705) |
| Repositorio GitOps | [Practicas-SA-B-202307705-gitops](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops) |
| CI exitoso | [Actions run 35005762218](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/35005762218) |
| Gate Trivy de imágenes en Pull Request | [PR #6](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/pull/6) — 16/16 comprobaciones correctas; el job usa `exit-code: 1` ante CVE `CRITICAL` |
| Release, SBOM, Trivy y Cosign | [Actions run 34937258452](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34937258452) — release `v0.8.5` |
| Corrección de drift de Argo Rollouts | [PR #7](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/pull/7) — Service estable con campos dinámicos ignorados de forma declarativa |
| PR de políticas Cosign y drift ArgoCD | [GitOps PR #11](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/11), [PR #15](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/15), [PR #16](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/16) y [documentación final #17](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/17) |
| Rollback Canary | [PR de prueba #12](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/12) y [restauración #13](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/13) |
| ArgoCD y políticas Terraform | [`live-validation-2026-09-15.txt`](evidence/live-validation-2026-09-15.txt) y [`policies-active.txt`](evidence/policies-active.txt) |
| Rechazo de imagen no firmada | [`kyverno-cosign-rejected.txt`](evidence/kyverno-cosign-rejected.txt) |
| Imagen firmada de referencia | `ghcr.io/davidvelasquez77/comicrent-api-gateway:v0.8.5` |
| Terraform plan/apply | [`terraform-validation.txt`](evidence/terraform-validation.txt) — reconstrucción desde estado vacío (19 agregados) y plan posterior sin cambios |
| k6 y umbrales | [`k6-summary.json`](evidence/k6-summary.json) |
| Informe del incidente | [`docs/incident-report.md`](docs/incident-report.md) |
| Video de entrega | Pendiente de grabar |

El `README` del repositorio GitOps deja explícito que ese repositorio contiene únicamente la aplicación y no ejecuta pipelines.

## Incidente controlado

La prueba controlada cambió temporalmente el endpoint del smoke test a una ruta inexistente. El `AnalysisTemplate` detectó el error durante el primer paso Canary, detuvo la promoción, mantuvo el tráfico en la versión estable y Argo Rollouts abortó la revisión nueva. La configuración sana se restauró mediante una PR posterior. El informe completo está en [`docs/incident-report.md`](docs/incident-report.md).
