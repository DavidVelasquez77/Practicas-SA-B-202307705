# Seed persistente

Este estado se aplica una vez y se conserva entre reconstrucciones. Administra el bucket remoto de Terraform, el bucket externo de Velero, versionado, retención, la cuenta de servicio y sus bindings IAM.

El bucket usado como backend debe existir antes de `terraform init`. En el primer uso se importa una vez:

```powershell
terraform init -reconfigure
terraform import google_storage_bucket.terraform_state comicrent-p9-tf-2026-202307705
terraform import google_storage_bucket.velero comicrent-p9-velero-2026-202307705
terraform apply
```

Nunca se ejecuta `terraform destroy` en este directorio durante una prueba de pérdida del clúster.
