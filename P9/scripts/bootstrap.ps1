[CmdletBinding()]
param(
  [string]$ProjectId = "comicrent-p6-2026",
  [string]$ClusterName = "comicrent-gke-p6",
  [string]$Zone = "us-central1-a",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$seedDir = Join-Path $root "P9/terraform/seed"
$appDir = Join-Path $root "P9/terraform/app"

function Invoke-Terraform([string]$Directory, [string[]]$Arguments) {
  Push-Location $Directory
  try { & terraform @Arguments }
  finally { Pop-Location }
  if ($LASTEXITCODE -ne 0) { throw "Terraform falló en ${Directory}: $($Arguments -join ' ')" }
}

function Invoke-Step([string]$Label, [scriptblock]$Command) {
  Write-Host "
[$Label]" -ForegroundColor Cyan
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Paso fallido: $Label (exit $LASTEXITCODE)" }
}

Invoke-Step "Cuenta y proyecto" { gcloud config set project $ProjectId }
Invoke-Step "Seed: inicializar backend remoto" { Invoke-Terraform $seedDir @("init", "-input=false", "-reconfigure") }

$seedResources = Invoke-Terraform $seedDir @("state", "list")
if ($seedResources -notcontains "google_storage_bucket.terraform_state") {
  Invoke-Terraform $seedDir @("import", "google_storage_bucket.terraform_state", "comicrent-p9-tf-2026-202307705")
}
if ($seedResources -notcontains "google_storage_bucket.velero") {
  Invoke-Terraform $seedDir @("import", "google_storage_bucket.velero", "comicrent-p9-velero-2026-202307705")
}
Invoke-Step "Seed: validar" { Invoke-Terraform $seedDir @("validate") }
Invoke-Step "Seed: aplicar recursos persistentes" { Invoke-Terraform $seedDir @("apply", "-input=false", "-auto-approve") }

Invoke-Step "App: inicializar backend remoto" { Invoke-Terraform $appDir @("init", "-input=false", "-reconfigure") }
Invoke-Step "App: validar" { Invoke-Terraform $appDir @("validate") }
if (-not $Apply) {
  Write-Host "Modo de verificación: use -Apply para crear GKE y ArgoCD." -ForegroundColor Yellow
  Invoke-Terraform $appDir @("plan", "-input=false")
  exit 0
}
Invoke-Step "App: GKE + node pool + ArgoCD + Application raíz" { Invoke-Terraform $appDir @("apply", "-input=false", "-auto-approve") }
Invoke-Step "Contexto Kubernetes" { gcloud container clusters get-credentials $ClusterName --zone $Zone --project $ProjectId }
Write-Host "Esperando la Application raíz comicrent-p9 y la reconciliación GitOps..." -ForegroundColor Cyan
kubectl wait --for=condition=Available deployment/argocd-server -n argocd --timeout=10m
$deadline = (Get-Date).AddMinutes(20)
do {
  $app = kubectl get application comicrent-p9 -n argocd -o json 2>$null | ConvertFrom-Json
  if ($app.status.sync.status -eq "Synced" -and $app.status.health.status -eq "Healthy") { break }
  Start-Sleep -Seconds 10
} while ((Get-Date) -lt $deadline)
if ($null -eq $app -or $app.status.sync.status -ne "Synced" -or $app.status.health.status -ne "Healthy") {
  kubectl get applications -n argocd -o wide
  throw "La Application raíz comicrent-p9 no llegó a Synced/Healthy dentro del tiempo límite."
}
Write-Host "Bootstrap completo: seed persistente, GKE, ArgoCD y app-of-apps activos." -ForegroundColor Green
