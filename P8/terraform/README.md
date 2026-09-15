# Bootstrap completo de P8

Terraform administra el ciclo de vida de la infraestructura y la plataforma:

1. API de GKE, clúster y node pool.
2. Namespaces, ResourceQuota, LimitRange y RBAC.
3. ArgoCD, Argo Rollouts, Kyverno y Sealed Secrets mediante `helm_release`.
4. Las cuatro políticas Kyverno.
5. El `AppProject` y la única `Application` `comicrent-p8`.

La `Application` apunta al repositorio GitOps. ArgoCD, y ningún workflow, instala
y reconcilia el chart de ComicRent.

## Requisitos locales

```bash
gcloud auth application-default login
terraform init
```

La clave de recuperación de Sealed Secrets debe existir fuera del repositorio:

```text
~/.comicrent/p8-sealed-secrets/tls.crt
~/.comicrent/p8-sealed-secrets/tls.key
```

Estos archivos permiten descifrar los mismos `SealedSecret` después de destruir
y reconstruir el clúster. La clave privada y los archivos `*.auto.tfvars` están
excluidos de Git.

Cree `local.auto.tfvars` con la IP pública desde la cual administrará GKE:

```hcl
master_authorized_cidr = "203.0.113.10/32"
```

Terraform habilita Workload Identity, usa el metadata server de GKE y restringe
el endpoint del control plane a ese CIDR. No se acepta `0.0.0.0/0`.

## Operación

```bash
terraform apply
terraform output
```

Para eliminar todos los recursos administrados:

```bash
terraform destroy
```

Para reconstruirlos usando la misma clave sellada:

```bash
terraform apply
```

Después del apply, el acceso operativo puede configurarse con:

```bash
gcloud container clusters get-credentials comicrent-gke-p6 \
  --zone us-central1-a \
  --project comicrent-p6-2026
```
