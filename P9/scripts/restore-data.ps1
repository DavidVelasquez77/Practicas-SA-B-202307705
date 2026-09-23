[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BackupName,
  [string]$RestoreName = ("p9-static-restore-{0}" -f (Get-Date -Format yyyyMMdd-HHmmss)),
  [string]$SourceNamespace = "sa-p9",
  [string]$RecoveryNamespace = "sa-p9-recovery",
  [string]$Velero = "velero"
)

$ErrorActionPreference = "Stop"
if ($Velero -eq "velero" -and (Test-Path (Join-Path $env:USERPROFILE "bin\\velero.exe"))) { $Velero = Join-Path $env:USERPROFILE "bin\\velero.exe" }

function Invoke-Kubectl {
  param([string[]]$Arguments)
  & kubectl @Arguments
  if ($LASTEXITCODE -ne 0) { throw "kubectl falló: kubectl $($Arguments -join ' ')" }
}

function Invoke-Velero {
  param([string[]]$Arguments)
  & $Velero @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Velero falló: $Velero $($Arguments -join ' ')" }
}

Write-Host "Restauración estática de PostgreSQL desde $BackupName" -ForegroundColor Cyan
Write-Host "Origen: $SourceNamespace | Recuperación: $RecoveryNamespace" -ForegroundColor DarkCyan

# Namespace limpio y StatefulSet excluido: Velero puede completar el volumen
# antes de que un controlador recree el pod y quite el helper de restauración.
& kubectl create namespace $RecoveryNamespace --dry-run=client -o yaml | kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw "No se pudo crear el namespace de recuperación." }

# Copia el secreto sin ownerReferences para que no sea eliminado con el
# SealedSecret original. Nunca se escribe la contraseña al repositorio.
$secretJson = kubectl -n $SourceNamespace get secret comicrent-postgresql-secret -o json
if ($LASTEXITCODE -ne 0) { throw "No existe comicrent-postgresql-secret en $SourceNamespace." }
$secret = $secretJson | ConvertFrom-Json
$secret.metadata.namespace = $RecoveryNamespace
foreach ($property in @("resourceVersion", "uid", "creationTimestamp", "managedFields", "ownerReferences")) {
  if ($secret.metadata.PSObject.Properties.Name -contains $property) { $secret.metadata.$property = $null }
}
$secret | ConvertTo-Json -Depth 100 | kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw "No se pudo preparar el secreto de PostgreSQL." }

Invoke-Velero @(
  "restore", "create", $RestoreName,
  "--from-backup=$BackupName",
  "--include-namespaces=$SourceNamespace",
  "--namespace-mappings=$SourceNamespace`:$RecoveryNamespace",
  "--include-cluster-resources=true",
  "--selector=app.kubernetes.io/name=postgresql",
  "--exclude-resources=statefulsets",
  "--restore-volumes=true"
)

# Do not use Velero CLI --wait here: it waits indefinitely when a pod-volume
# restore is blocked (for example, by an init-container security context).
# Poll the Restore CR with a bounded timeout so the operator can troubleshoot.
$restoreDeadline = (Get-Date).AddMinutes(20)
$lastRestorePhase = $null
do {
  $restoreJson = & kubectl get restore $RestoreName -n velero -o json
  if ($LASTEXITCODE -ne 0) { throw "No se pudo leer el estado del restore $RestoreName." }
  $restoreObject = $restoreJson | ConvertFrom-Json
  $restorePhase = $restoreObject.status.phase
  if ($restorePhase -ne $lastRestorePhase) {
    Write-Host "Estado Velero: $restorePhase" -ForegroundColor DarkCyan
    $lastRestorePhase = $restorePhase
  }
  if ($restorePhase -in @("Completed", "Failed", "PartiallyFailed")) { break }
  if ((Get-Date) -ge $restoreDeadline) {
    throw "Timeout: el restore $RestoreName no terminó en 20 minutos. Consulte 'velero restore describe $RestoreName --details' y los PodVolumeRestore."
  }
  Start-Sleep -Seconds 10
} while ($true)

if ($restorePhase -ne "Completed") {
  & $Velero restore describe $RestoreName --details
  throw "Velero terminó el restore $RestoreName con estado $restorePhase."
}

# La restauración aislada no pertenece a la aplicación GitOps de producción.
# Velero conserva las anotaciones de tracking del backup; quitarlas evita que
# ArgoCD intente reconciliar estos objetos temporales dentro de sa-p9.
$restoreResources = & kubectl get pods,services,statefulsets,controllerrevisions,configmaps,secrets,serviceaccounts,persistentvolumeclaims,poddisruptionbudgets -n $RecoveryNamespace -o name 2>$null
if ($LASTEXITCODE -eq 0) {
  foreach ($resource in $restoreResources) {
    $metadata = & kubectl get $resource -n $RecoveryNamespace -o json 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -eq 0 -and $metadata.metadata.annotations.'argocd.argoproj.io/tracking-id') {
      & kubectl annotate $resource -n $RecoveryNamespace 'argocd.argoproj.io/tracking-id-' --overwrite
      if ($LASTEXITCODE -ne 0) { throw "No se pudo desvincular de ArgoCD el recurso temporal $resource." }
    }
  }
}

Invoke-Kubectl @("wait", "--for=condition=Ready", "pod/comicrent-postgresql-0", "-n", $RecoveryNamespace, "--timeout=10m")
Write-Host "`nEstado del restore y volúmenes:" -ForegroundColor Green
& $Velero restore get $RestoreName
kubectl get podvolumerestore -n velero -l velero.io/restore-name=$RestoreName -o custom-columns=NAME:.metadata.name,PHASE:.status.phase,BYTES:.status.progress.bytesDone/TOTAL:.status.progress.totalBytes

$password = kubectl -n $RecoveryNamespace get secret comicrent-postgresql-secret -o jsonpath='{.data.password}'
if ($LASTEXITCODE -eq 0 -and $password) {
  $decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($password))
  Write-Host "`nDato restaurado (tabla p9_recovery_probe):" -ForegroundColor Green
  & kubectl exec -n $RecoveryNamespace comicrent-postgresql-0 -- env "PGPASSWORD=$decoded" psql -U comicrent_user -d auth_db -tAc "SELECT id || '|' || marker || '|' || created_at FROM p9_recovery_probe ORDER BY id DESC LIMIT 1;"
  if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar el dato restaurado en PostgreSQL." }
}

Write-Host "Restauración verificada en $RecoveryNamespace." -ForegroundColor Green
