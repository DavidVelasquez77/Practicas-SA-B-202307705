[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$MasterAuthorizedCidr,
  [Parameter(Mandatory = $true)][string]$BackupName,
  [switch]$DestroyApp,
  [switch]$PreflightOnly,
  [int]$NodeCount = 3
)

$ErrorActionPreference = "Stop"
if (-not $DestroyApp -and -not $PreflightOnly) { throw "Este simulacro elimina P9 app. Pase -DestroyApp explícitamente después de confirmar el preflight." }
if ($MasterAuthorizedCidr -notmatch '^(?!0\.0\.0\.0/0$)(\d{1,3}\.){3}\d{1,3}/\d{1,2}$') { throw "CIDR inválido o demasiado abierto." }
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$originalLocation = Get-Location
Set-Location $repoRoot
$run = Get-Date -Format 'yyyyMMdd-HHmmss'
$restoreName = "p9-dr-restore-$run"
$recoveryNamespace = "sa-p9-dr-$run"
$transcript = Join-Path $repoRoot "P9/evidence/p9-reconstruction-$run.txt"
$rtoStart = $null
$success = $false

function Invoke-Native {
  param([string]$File, [string[]]$Arguments, [string]$Description)
  & $File @Arguments 2>&1 | ForEach-Object { Write-Host ([string]$_) }
  if ($LASTEXITCODE -ne 0) { throw "$Description terminó con código $LASTEXITCODE." }
}

# Preflight fuera del cronómetro: confirma backup íntegro y aplicación actual sana.
$backupJson = kubectl get backup $BackupName -n velero -o json
if ($LASTEXITCODE -ne 0) { throw "No se encontró el backup $BackupName." }
$backup = $backupJson | ConvertFrom-Json
if ($backup.status.phase -ne "Completed" -or [int]$backup.status.errors -gt 0 -or [int]$backup.status.warnings -gt 0) {
  throw "El backup $BackupName no está Completed sin errores ni advertencias."
}
$certVersionsRaw = gcloud secrets versions list comicrent-p9-sealed-secrets-tls-crt --project comicrent-p6-2026 --format=json
$certExit = $LASTEXITCODE
$keyVersionsRaw = gcloud secrets versions list comicrent-p9-sealed-secrets-tls-key --project comicrent-p6-2026 --format=json
$keyExit = $LASTEXITCODE
if ($certExit -ne 0 -or $keyExit -ne 0) { throw "No se pudo consultar la llave persistente en Secret Manager." }
$certVersions = $certVersionsRaw | ConvertFrom-Json
$keyVersions = $keyVersionsRaw | ConvertFrom-Json
if (-not @($certVersions | Where-Object state -eq "ENABLED").Count -or -not @($keyVersions | Where-Object state -eq "ENABLED").Count) {
  throw "La llave persistente de Sealed Secrets no está disponible en Secret Manager."
}
$publicIp = (Invoke-RestMethod 'https://api.ipify.org').Trim()
$expectedIp = $MasterAuthorizedCidr.Split('/')[0]
if ($publicIp -ne $expectedIp) { throw "La IP pública actual ($publicIp) no coincide con el CIDR autorizado ($MasterAuthorizedCidr). Actualícelo antes del simulacro." }

# Verifica salud, custodia de llave y ausencia de drift antes de iniciar el RTO.
Invoke-Native "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "P9/scripts/verify.ps1", "-TerraformPlan") "Preflight de salud y Terraform"

if ($PreflightOnly) {
  Write-Host "Preflight correcto: backup Completed sin errores/advertencias, llave accesible, IP vigente."
  Write-Host "El plan siguiente corresponde solo a P9/terraform/app; no se aplicará."
  terraform -chdir=P9/terraform/app plan -destroy -input=false -no-color "-var=master_authorized_cidr=$MasterAuthorizedCidr" "-var=node_count=$NodeCount"
  if ($LASTEXITCODE -ne 0) { throw "Falló el plan destroy de app." }
  Write-Host "No se destruyó ningún recurso. Revise que el plan no incluya seed, Secret Manager ni buckets antes de repetir sin -PreflightOnly y con -DestroyApp."
  return
}

Start-Transcript -LiteralPath $transcript -Force | Out-Null
try {
  $rtoStart = [DateTimeOffset]::UtcNow
  Write-Host "Inicio RTO UTC: $($rtoStart.ToString('o'))"
  Write-Host "Backup validado: $BackupName; destino de restauración: $recoveryNamespace"

  # Quita el finalizer de la raíz y elimínala por separado. Así ArgoCD no vuelve
  # a colocar finalizers de pre-delete en aplicaciones hijas durante el destroy.
  Invoke-Native "kubectl" @("patch", "application", "comicrent-p9", "-n", "argocd", "--type=merge", "-p", '{"metadata":{"finalizers":[]}}') "Retiro del finalizer de la Application raíz"
  Invoke-Native "terraform" @("-chdir=P9/terraform/app", "destroy", "-target=helm_release.argocd_root", "-input=false", "-auto-approve", "-var=master_authorized_cidr=$MasterAuthorizedCidr", "-var=node_count=$NodeCount") "Eliminación de la raíz ArgoCD"

  # Como solo app será destruida, soltar los finalizers hijos permite eliminar
  # argocd sin depender de hooks de pre-delete que el propio clúster está borrando.
  $applications = kubectl get applications -n argocd -o json 2>$null | ConvertFrom-Json
  if ($LASTEXITCODE -eq 0) {
    foreach ($application in $applications.items) {
      if (@($application.metadata.finalizers).Count -gt 0) {
        Invoke-Native "kubectl" @("patch", "application", $application.metadata.name, "-n", "argocd", "--type=merge", "-p", '{"metadata":{"finalizers":[]}}') "Retiro de finalizer de $($application.metadata.name)"
      }
    }
  }

  Invoke-Native "terraform" @("-chdir=P9/terraform/app", "destroy", "-input=false", "-auto-approve", "-var=master_authorized_cidr=$MasterAuthorizedCidr", "-var=node_count=$NodeCount") "Terraform destroy de P9 app"

  $seedState = terraform -chdir=P9/terraform/seed state list
  if ($LASTEXITCODE -ne 0 -or $seedState -notcontains "google_storage_bucket.velero" -or $seedState -notcontains "google_secret_manager_secret.sealed_secrets_key") {
    throw "El estado persistente seed o los recursos de recuperación no están disponibles después del destroy."
  }

  Invoke-Native "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "P9/scripts/bootstrap.ps1", "-MasterAuthorizedCidr", $MasterAuthorizedCidr, "-NodeCount", "$NodeCount", "-Apply") "Bootstrap desde Secret Manager"
  Invoke-Native "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "P9/scripts/verify.ps1") "Verificación de plataforma reconstruida"

  Invoke-Native "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "P9/scripts/restore-data.ps1", "-BackupName", $BackupName, "-RestoreName", $restoreName, "-SourceNamespace", "sa-p9", "-RecoveryNamespace", $recoveryNamespace) "Restauración Velero aislada"

  $sourceEncoded = kubectl -n $recoveryNamespace get secret comicrent-postgresql-secret -o jsonpath='{.data.password}'
  if ($LASTEXITCODE -ne 0 -or -not $sourceEncoded) { throw "Falta el secreto PostgreSQL en el namespace recuperado." }
  $sourcePassword = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($sourceEncoded -join '').Trim()))
  $recovered = kubectl exec -n $recoveryNamespace comicrent-postgresql-0 -c postgresql -- env "PGPASSWORD=$sourcePassword" psql -X -U comicrent_user -d auth_db -At -F '|' -c "SELECT id, marker, created_at::text FROM public.p9_recovery_probe WHERE id=1;"
  if ($LASTEXITCODE -ne 0) { throw "No se pudo leer la fila recuperada." }
  $fields = "$recovered".Trim() -split '\|', 3
  if ($fields.Count -ne 3 -or $fields[0] -ne "1" -or $fields[1] -notmatch '^P9-BEFORE-BACKUP-\d{8}-\d{6}$') { throw "La fila recuperada no coincide con el formato esperado." }
  $createdAt = [DateTimeOffset]::Parse($fields[2], [Globalization.CultureInfo]::InvariantCulture).ToString('o', [Globalization.CultureInfo]::InvariantCulture)

  $activeEncoded = kubectl -n sa-p9 get secret comicrent-postgresql-secret -o jsonpath='{.data.password}'
  if ($LASTEXITCODE -ne 0 -or -not $activeEncoded) { throw "Falta el secreto PostgreSQL activo." }
  $activePassword = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($activeEncoded -join '').Trim()))
  # Marker y timestamp se validan/normalizan antes de interpolar el SQL.
  $sql = @"
BEGIN;
CREATE TABLE IF NOT EXISTS public.p9_recovery_probe (
  id integer PRIMARY KEY,
  marker text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.p9_recovery_probe (id, marker, created_at)
VALUES (1, '$($fields[1])', '$createdAt'::timestamptz)
ON CONFLICT (id) DO UPDATE SET marker=EXCLUDED.marker, created_at=EXCLUDED.created_at;
COMMIT;
"@
  Invoke-Native "kubectl" @("exec", "-n", "sa-p9", "comicrent-postgresql-0", "-c", "postgresql", "--", "env", "PGPASSWORD=$activePassword", "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", "comicrent_user", "-d", "auth_db", "-c", $sql) "Promoción del marcador recuperado"

  $activeMarker = kubectl exec -n sa-p9 comicrent-postgresql-0 -c postgresql -- env "PGPASSWORD=$activePassword" psql -X -U comicrent_user -d auth_db -Atc "SELECT id || '|' || marker FROM public.p9_recovery_probe WHERE id=1;"
  if ($LASTEXITCODE -ne 0 -or "$activeMarker".Trim() -ne "1|$($fields[1])") { throw "El marcador recuperado no quedó verificado en auth_db activa." }
  Invoke-Native "pwsh" @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "P9/scripts/verify.ps1") "Verificación final de servicio"

  $rtoEnd = [DateTimeOffset]::UtcNow
  $duration = $rtoEnd - $rtoStart
  Write-Host "Dato recuperado y validado: 1|$($fields[1])"
  Write-Host "Fin RTO UTC: $($rtoEnd.ToString('o'))"
  Write-Host "RTO medido (destroy, bootstrap y recuperación del marcador): $($duration.ToString('c'))"
  Write-Host "Backup: $BackupName; Restore: $restoreName; Namespace de validación: $recoveryNamespace"
  $success = $true
}
finally {
  if ($rtoStart) {
    if (-not $success) { Write-Host "Simulacro incompleto; iniciado UTC: $($rtoStart.ToString('o')); revisar esta transcripción antes de repetir." -ForegroundColor Red }
  }
  Stop-Transcript | Out-Null
  Set-Location $originalLocation
}
