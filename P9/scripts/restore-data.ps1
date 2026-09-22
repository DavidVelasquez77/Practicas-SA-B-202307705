[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$BackupName,
  [string]$RestoreName = ("p9-restore-{0}" -f (Get-Date -Format yyyyMMdd-HHmmss)),
  [string]$Namespace = "sa-p9"
)
$ErrorActionPreference = "Stop"
velero restore create $RestoreName --from-backup=$BackupName --include-namespaces=$Namespace --include-cluster-resources=true --wait
if ($LASTEXITCODE -ne 0) { throw "La restauración Velero falló." }
kubectl rollout status statefulset/comicrent-postgresql -n $Namespace --timeout=10m
Write-Host "Verifique el dato real con seed-recovery-data.ps1 mediante psql." -ForegroundColor Green
