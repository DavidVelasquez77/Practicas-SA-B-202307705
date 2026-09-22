[CmdletBinding()]
param(
  [string]$ProjectId = "comicrent-p6-2026",
  [string]$ClusterName = "comicrent-gke-p6",
  [string]$Zone = "us-central1-a",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$tfDir = Join-Path $root "P8/terraform"

function Invoke-Step([string]$Label, [scriptblock]$Command) {
  Write-Host "`n[$Label]" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Paso fallido: $Label (exit $LASTEXITCODE)" }
}

Invoke-Step "Cuenta y proyecto" { gcloud config set project $ProjectId }
Invoke-Step "Credenciales de GKE" { gcloud container clusters get-credentials $ClusterName --zone $Zone --project $ProjectId }
Invoke-Step "Backend remoto y proveedores" { terraform -chdir=$tfDir init -input=false -reconfigure }
Invoke-Step "Validación Terraform" { terraform -chdir=$tfDir validate }

# Si el clúster desapareció, los recursos Kubernetes/Helm del estado remoto ya
# no pueden refrescarse. Se retiran sólo esas entradas; Terraform conserva el
# estado de GKE, GCS y las cuentas IAM y las vuelve a aplicar después del clúster.
$clusterExists = $true
gcloud container clusters describe $ClusterName --zone $Zone --project $ProjectId --format='value(name)' | Out-Null
if ($LASTEXITCODE -ne 0) { $clusterExists = $false }
if (-not $clusterExists) {
  Write-Host "Clúster ausente: limpiando del estado sólo recursos Kubernetes/Helm para reconstrucción." -ForegroundColor Yellow
  $addresses = terraform -chdir=$tfDir state list | Where-Object { $_ -match '^(kubernetes_|helm_release\.)' }
  if ($addresses) { terraform -chdir=$tfDir state rm $addresses }
}

if (-not $Apply) {
  Write-Host "Modo de verificación: use -Apply para ejecutar el único bootstrap." -ForegroundColor Yellow
  terraform -chdir=$tfDir plan -input=false
  exit 0
}

Invoke-Step "Bootstrap Terraform + ArgoCD + Velero" { terraform -chdir=$tfDir apply -input=false -auto-approve }
Invoke-Step "Contexto Kubernetes" { kubectl config use-context ("gke_{0}_{1}_{2}" -f $ProjectId,$Zone,$ClusterName) }

Write-Host "Esperando ArgoCD y la aplicación raíz comicrent-p9..." -ForegroundColor Cyan
kubectl wait --for=condition=Available deployment/argocd-server -n argocd --timeout=10m
$deadline = (Get-Date).AddMinutes(15)
do {
  $app = kubectl get application comicrent-p9 -n argocd -o json 2>$null | ConvertFrom-Json
  if ($app.status.sync.status -eq "Synced" -and $app.status.health.status -eq "Healthy") { break }
  Start-Sleep -Seconds 10
} while ((Get-Date) -lt $deadline)
if ($null -eq $app -or $app.status.sync.status -ne "Synced" -or $app.status.health.status -ne "Healthy") {
  kubectl get applications -n argocd -o wide
  throw "La aplicación raíz comicrent-p9 no llegó a Synced/Healthy dentro del tiempo límite."
}

Write-Host "Bootstrap completo: Terraform remoto, ArgoCD app-of-apps y cargas P9 activos." -ForegroundColor Green
