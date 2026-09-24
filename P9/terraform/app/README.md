# App efímera

Este estado usa el prefijo remoto `p9/app` y sólo administra la base que debe existir antes de GitOps:

- clúster GKE y node pool;
- namespace y Helm release de ArgoCD;
- clave persistente de Sealed Secrets recuperada desde Secret Manager; el estado remoto GCS `p9/app` contiene el recurso Kubernetes Secret y requiere IAM restringido;
- Application raíz `comicrent-p9`.

No contiene Helm releases de Velero, Kyverno, Argo Rollouts ni de ComicRent. Esos recursos están declarados como Applications en `apps/p9` del repositorio GitOps y ArgoCD los crea después del bootstrap.

Para destruir y reconstruir el entorno se trabaja únicamente en este directorio:

```powershell
terraform init -reconfigure
terraform destroy
```

El estado `seed` y sus buckets no se destruyen.
