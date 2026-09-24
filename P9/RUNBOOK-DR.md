# Runbook de recuperación ante desastre — P9

Este procedimiento reconstruye la plataforma P9 y verifica la recuperación del dato de prueba de PostgreSQL. Se ejecuta desde la raíz del repositorio de código. El operador necesita acceso autenticado a GCP, permisos para ejecutar Terraform y acceso a Secret Manager. La llave TLS persistente de Sealed Secrets se conserva allí; después de la carga inicial, no hace falta obtenerla del autor ni guardar archivos locales.

## 1. Preparar el operador y los recursos persistentes

Inicia sesión con una identidad que pueda leer/escribir el estado remoto, administrar GKE y acceder a los buckets. Configura el proyecto y ADC:

~~~powershell
gcloud auth login
gcloud auth application-default login
gcloud config set project comicrent-p6-2026
gcloud auth application-default set-quota-project comicrent-p6-2026
~~~

Confirma que seed y el backup externo siguen disponibles:

~~~powershell
terraform -chdir=P9/terraform/seed init -input=false -reconfigure
terraform -chdir=P9/terraform/seed state list
~~~

El estado debe estar en el prefijo GCS p9/seed. El bucket de estado y el bucket Velero se conservan durante el destroy de app. No ejecutes terraform destroy desde P9/terraform/seed.

Confirma que las versiones de la llave TLS existen en Secret Manager. No leas ni imprimas sus valores:

~~~powershell
gcloud secrets versions list comicrent-p9-sealed-secrets-tls-crt --project comicrent-p6-2026 --format="table(name,state,createTime)"
gcloud secrets versions list comicrent-p9-sealed-secrets-tls-key --project comicrent-p6-2026 --format="table(name,state,createTime)"
~~~

Ambos secretos deben tener al menos una versión `ENABLED`. El principal activo debe tener acceso de lectura. En la instalación inicial sin versiones, el bootstrap requiere los archivos originales en `~/.comicrent/p8-sealed-secrets/`; después de cargarlos, la continuidad ya no depende de esa máquina. El contenido de la llave no se imprime.

## 2. Reconstruir el clúster y la plataforma

Para la reconstrucción normal desde cero, obtén la IP pública actual y ejecuta el punto de entrada del bootstrap:

~~~powershell
$publicIp = (Invoke-RestMethod 'https://api.ipify.org').Trim()
$cidr = "$publicIp/32"
pwsh -NoProfile -ExecutionPolicy Bypass -File P9/scripts/bootstrap.ps1 -MasterAuthorizedCidr $cidr -Apply
if ($LASTEXITCODE -ne 0) { throw 'Bootstrap incompleto; revisar salida de Terraform, GKE y ArgoCD.' }
~~~

El script inicializa y aplica seed, asegura las versiones protegidas en Secret Manager, reconstruye app, instala ArgoCD, recupera la llave persistente y crea la Application raíz comicrent-p9. ArgoCD reconcilia automáticamente las Applications restantes desde el repositorio GitOps, ruta apps/p9. No ejecutes kubectl apply ni helm upgrade para desplegar las aplicaciones.

Para repetir un simulacro destructivo completo, usa el wrapper que valida el backup, la llave y la IP antes de iniciar. El preflight no destruye recursos y muestra el plan:

~~~powershell
$backupList = kubectl get backups -n velero -o json
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar los backups de Velero.' }
$backupObject = ($backupList | ConvertFrom-Json).items |
  Where-Object { $_.status.phase -eq 'Completed' -and [int]$_.status.errors -eq 0 -and [int]$_.status.warnings -eq 0 } |
  Sort-Object { [DateTimeOffset]::Parse($_.metadata.creationTimestamp) } -Descending |
  Select-Object -First 1
if (-not $backupObject) { throw 'No hay un backup Completed sin errores ni advertencias.' }
$backup = $backupObject.metadata.name
"Backup seleccionado: $backup"
$publicIp = (Invoke-RestMethod 'https://api.ipify.org').Trim()
$cidr = "$publicIp/32"
pwsh -NoProfile -ExecutionPolicy Bypass -File P9/scripts/rebuild-dr.ps1 -MasterAuthorizedCidr $cidr -BackupName $backup -PreflightOnly
~~~

Revisa el plan y confirma que solo afecta recursos de `P9/terraform/app`. Cuando se autorice el simulacro, ejecuta el mismo wrapper con `-DestroyApp` en lugar de `-PreflightOnly`; el script registra el inicio/fin UTC, destruye y reconstruye `app`, restaura el marcador desde Velero y lo comprueba en la base activa. No ejecutes simultáneamente comandos Terraform sobre esos estados.

Ejecuta la verificación de solo lectura:

~~~powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File P9/scripts/verify.ps1
if ($LASTEXITCODE -ne 0) { throw 'La plataforma no está lista; no continúe con la restauración.' }
kubectl get applications -n argocd -o wide
kubectl get pvc,pods -n sa-p9
kubectl get backupstoragelocation,schedule -n velero
~~~

Continúa cuando el clúster esté accesible, las Applications estén Synced/Healthy, los secretos descifrados, los PVC estén Bound, Velero Available y el endpoint responda HTTP 200.

## 3. Restaurar y verificar PostgreSQL desde Velero

Lista los backups y selecciona el más reciente con fase Completed y sin errores:

~~~powershell
$backupList = kubectl get backups -n velero -o json
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar los backups de Velero.' }
$backupObject = ($backupList | ConvertFrom-Json).items |
  Where-Object { $_.status.phase -eq 'Completed' -and [int]$_.status.errors -eq 0 -and [int]$_.status.warnings -eq 0 } |
  Sort-Object { [DateTimeOffset]::Parse($_.metadata.creationTimestamp) } -Descending |
  Select-Object -First 1
if (-not $backupObject) { throw 'No hay un backup Completed sin errores ni advertencias.' }
$backup = $backupObject.metadata.name
"Backup seleccionado: $backup"
velero backup describe $backup --details
~~~

Usa un nombre de restore y namespace nuevos. La restauración queda aislada para inspeccionar el contenido antes de promover datos:

~~~powershell
$backupList = kubectl get backups -n velero -o json
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar los backups de Velero.' }
$backupObject = ($backupList | ConvertFrom-Json).items |
  Where-Object { $_.status.phase -eq 'Completed' -and [int]$_.status.errors -eq 0 -and [int]$_.status.warnings -eq 0 } |
  Sort-Object { [DateTimeOffset]::Parse($_.metadata.creationTimestamp) } -Descending |
  Select-Object -First 1
if (-not $backupObject) { throw 'No hay un backup Completed sin errores ni advertencias.' }
$backup = $backupObject.metadata.name
"Backup seleccionado: $backup"
$run = Get-Date -Format 'yyyyMMdd-HHmmss'
$restore = "p9-recovery-$run"
$recoveryNamespace = "sa-p9-recovery-$run"
pwsh -NoProfile -ExecutionPolicy Bypass -File P9/scripts/restore-data.ps1 -BackupName $backup -RestoreName $restore -SourceNamespace sa-p9 -RecoveryNamespace $recoveryNamespace
if ($LASTEXITCODE -ne 0) { throw 'Restore no completado; revisar Restore y PodVolumeRestore.' }
kubectl get restore $restore -n velero -o wide
kubectl get podvolumerestore -n velero -l "velero.io/restore-name=$restore"
~~~

Verifica que Restore y todos los PodVolumeRestore estén Completed y que la salida del script muestre el contenido esperado de auth_db.p9_recovery_probe. Conserva el namespace de recuperación hasta terminar la comprobación.

## 4. Promover el dato de prueba a la base activa

En este laboratorio se restauró y promovió únicamente la fila P9 de validación, no se reemplazó el volumen de PostgreSQL en producción. Copia el marcador exacto que imprimió el restore aislado y confirma el destino antes de ejecutar la inserción:

~~~powershell
$marker = 'MARCADOR_LEIDO_DEL_RESTORE'
$encoded = kubectl -n sa-p9 get secret comicrent-postgresql-secret -o jsonpath='{.data.password}'
$password = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($encoded -join '').Trim()))
$sql = "CREATE TABLE IF NOT EXISTS public.p9_recovery_probe (id integer PRIMARY KEY, marker text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()); INSERT INTO public.p9_recovery_probe(id, marker) VALUES (1, '$marker') ON CONFLICT (id) DO UPDATE SET marker=EXCLUDED.marker, created_at=now();"
kubectl exec -n sa-p9 comicrent-postgresql-0 -c postgresql -- env "PGPASSWORD=$password" psql -X -v ON_ERROR_STOP=1 -U comicrent_user -d auth_db -c $sql
if ($LASTEXITCODE -ne 0) { throw 'No se pudo promover el marcador a la base activa.' }
kubectl exec -n sa-p9 comicrent-postgresql-0 -c postgresql -- env "PGPASSWORD=$password" psql -X -U comicrent_user -d auth_db -Atc 'SELECT id || ''|'' || marker FROM public.p9_recovery_probe WHERE id=1;'
~~~

La consulta final debe devolver el mismo identificador y marcador que el restore aislado. Este comando promueve solo el marcador de validación; la recuperación de otras bases o tablas requiere un procedimiento de promoción específico, probado y aprobado para esos datos.

## 5. Registrar resultado y conservar recursos

Registra las marcas UTC, el nombre del backup/restore, errores y warnings, el contenido verificado, RTO y RPO. Conserva seed, el backend remoto y el bucket externo. No borres el namespace de recuperación ni el backup hasta guardar las evidencias y confirmar que ya no se necesitan para el análisis.

La evidencia del simulacro ejecutado está en evidence/p9-reconstruction.txt, evidence/p9-backup-restore.txt y evidence/p9-node-drain.txt. El informe de resultados está en INFORME-DR.md.
