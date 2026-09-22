# Informe de recuperación ante desastre — P9

## Escenario

Se eliminó de forma controlada el clúster GKE `comicrent-gke-p6` para simular la pérdida total de la plataforma. El repositorio de código y el repositorio GitOps permanecieron intactos. Antes de la prueba se creó el backup Velero `p9-functional-rebuild-v2` en el bucket externo `comicrent-p9-velero-2026-202307705`; el backup terminó con cero errores y cero advertencias e incluyó los volúmenes de PostgreSQL y RabbitMQ.

## Recuperación ejecutada

1. `P9/scripts/bootstrap.ps1 -Apply` inicializó el backend remoto de Terraform, recreó GKE y el node pool, instaló los controladores y creó la Application raíz `comicrent-p9`.
2. ArgoCD reconcilió `comicrent-p9-workloads` desde la rama `p9-continuidad-operativa`. Las aplicaciones P8 y P9 terminaron `Synced/Healthy`; los PVC de PostgreSQL y RabbitMQ quedaron `Bound`.
3. `P9/scripts/restore-data.ps1` creó un namespace de recuperación, copió el secreto de PostgreSQL sin propietario de Sealed Secrets y ejecutó un restore estático con namespace mapping. Los tres `PodVolumeRestore` terminaron `Completed` y el PVC de PostgreSQL restauró 113,369,312 bytes.
4. La consulta a `auth_db.p9_recovery_probe` devolvió `1|P9-REAL-DATA-20260922-RERUN`, demostrando que se recuperó contenido persistente y no sólo un pod vacío.

## Resultado y objetivos

El clúster reconstruido quedó con tres nodos Ready, ArgoCD y Velero operativos, la Schedule `comicrent-p9-daily` habilitada cada seis horas y el gateway accesible. El objetivo de RTO es de dos horas para volver a tener la plataforma reconciliada; el RPO es de seis horas por la frecuencia de la Schedule, reducido en la prueba mediante el backup manual previo al incidente. La evidencia completa está en [`evidence/p9-bootstrap.txt`](evidence/p9-bootstrap.txt) y [`evidence/p9-backup-restore.txt`](evidence/p9-backup-restore.txt).

## Prueba de continuidad

Se drenó un nodo que alojaba una réplica del gateway. El PDB, las tres réplicas, la anti-affinity y las probes permitieron evacuar el pod y reprogramarlo en otro nodo; el endpoint `/health` respondió HTTP 200 antes y después. La salida está en [`evidence/p9-node-drain.txt`](evidence/p9-node-drain.txt).

## Causa y controles

El impacto potencial era la pérdida simultánea del plano de control y de los volúmenes. Se mitigó separando el estado y los backups del clúster, usando Workload Identity en lugar de claves estáticas, conservando la clave de Sealed Secrets y declarando la plataforma con Terraform y ArgoCD. El procedimiento queda automatizado y repetible en los scripts de `P9/scripts`.
