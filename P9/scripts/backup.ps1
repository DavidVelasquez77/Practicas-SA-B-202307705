[CmdletBinding()]
param(
  [string]$Name = ("p9-manual-{0}" -f (Get-Date -Format yyyyMMdd-HHmmss)),
  [string]$Namespace = "sa-p9",
  [string]$Velero = "velero"
)
$ErrorActionPreference = "Stop"
if ($Velero -eq "velero" -and (Test-Path (Join-Path $env:USERPROFILE "bin\\velero.exe"))) { $Velero = Join-Path $env:USERPROFILE "bin\\velero.exe" }
& $Velero backup-location get
if ($LASTEXITCODE -ne 0) { throw "Velero no está disponible." }
& $Velero backup create $Name --include-namespaces $Namespace --include-cluster-resources=true --default-volumes-to-fs-backup --wait
if ($LASTEXITCODE -ne 0) { throw "El respaldo Velero falló." }
& $Velero backup get $Name
& $Velero backup describe $Name --details
