# Seed persistente

Este estado se aplica una vez y se conserva entre reconstrucciones. Administra el bucket remoto de Terraform, el bucket de Velero, un bucket separado para respaldos físicos/WAL de CloudNativePG, versionado, retención y cuentas de servicio con sus bindings IAM. Mantener los objetos de PostgreSQL fuera de la raíz del bucket de Velero evita que Velero marque su `BackupStorageLocation` como no disponible por prefijos desconocidos.

El bucket usado como backend debe existir antes de `terraform init`. En el primer uso se importa una vez:

```powershell
terraform init -reconfigure
terraform import google_storage_bucket.terraform_state comicrent-p9-tf-2026-202307705
terraform import google_storage_bucket.velero comicrent-p9-velero-2026-202307705
terraform apply
```

El bucket `comicrent-p9-postgres-2026-202307705` y la cuenta `cnpg-p9-backup` son administrados por este mismo estado. CloudNativePG usa Workload Identity y sólo tiene permisos de objetos sobre ese bucket; Velero conserva acceso al bucket de Velero.

Nunca se ejecuta `terraform destroy` en este directorio durante una prueba de pérdida del clúster.
