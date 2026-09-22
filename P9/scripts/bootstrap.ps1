[CmdletBinding()]
param(
  [string]$ProjectId = "comicrent-p6-2026",
  [string]$ClusterName = "comicrent-gke-p6",
  [string]$Zone = "us-central1-a",
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^(?!0\.0\.0\.0/0$)(\d{1,3}\.){3}\d{1,3}/\d{1,2}$')]
  [string]$MasterAuthorizedCidr,
  [ValidateRange(1, 100)]
  [int]$NodeCount = 3,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
$seedDir = Join-Path $root "P9/terraform/seed"
$appDir = Join-Path $root "P9/terraform/app"
$stateBucket = "comicrent-p9-tf-2026-202307705"
$veleroBucket = "comicrent-p9-velero-2026-202307705"

function Invoke-Terraform([string]$Directory, [string[]]$Arguments) {
  Push-Location $Directory
  try {
    & terraform @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Terraform falló: terraform $($Arguments -join ' ')" }
  }
  finally { Pop-Location }
}

function Get-TerraformState([string]$Directory) {
  Push-Location $Directory
  try {
    $items = & terraform state list
    if ($LASTEXITCODE -ne 0) { throw "No se pudo leer el estado Terraform en $Directory" }
    return @($items)
  }
  finally { Pop-Location }
}

function Invoke-Step([string]$Label, [scriptblock]$Command) {
  Write-Host "`n[$Label]" -ForegroundColor Cyan
  & $Command
}

function Import-ExistingClusterIfNeeded {
  $state = Get-TerraformState $appDir
  if ($state -contains "google_container_cluster.comicrent") { return }

  & gcloud container clusters describe $ClusterName --zone $Zone --project $ProjectId --format="value(name)" 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { return }

  Write-Host "El clúster ya existe pero aún no está en p9/app; se importa al estado remoto antes de aplicar." -ForegroundColor Yellow
  $importDir = Join-Path $env:TEMP "p9-app-import-state"
  New-Item -ItemType Directory -Force -Path $importDir | Out-Null
  $importConfig = @"
terraform {
  backend "gcs" {
    bucket = "$stateBucket"
    prefix = "p9/app"
  }
  required_providers {
    google = { source = "hashicorp/google", version = "~> 7.0" }
  }
}
provider "google" {
  project = "$ProjectId"
  region  = "us-central1"
  zone    = "$Zone"
}
resource "google_container_cluster" "comicrent" {
  name     = "$ClusterName"
  location = "$Zone"
  project  = "$ProjectId"
}
resource "google_project_service" "container" {
  project = "$ProjectId"
  service = "container.googleapis.com"
}
"@
  Set-Content -Path (Join-Path $importDir "main.tf") -Value $importConfig -Encoding ascii
  Invoke-Terraform $importDir @("init", "-input=false", "-reconfigure")
  $state = Get-TerraformState $importDir
  if ($state -notcontains "google_project_service.container") {
    Invoke-Terraform $importDir @("import", "-input=false", "google_project_service.container", "$ProjectId/container.googleapis.com")
  }
  if ($state -notcontains "google_container_cluster.comicrent") {
    Invoke-Terraform $importDir @("import", "-input=false", "google_container_cluster.comicrent", "$ProjectId/$Zone/$ClusterName")
  }
}

if ([string]::IsNullOrWhiteSpace($MasterAuthorizedCidr)) {
  throw "Indique -MasterAuthorizedCidr con la IP pública autorizada en formato CIDR (por ejemplo, 203.0.113.10/32)."
}

Invoke-Step "Cuenta y proyecto" { & gcloud config set project $ProjectId; if ($LASTEXITCODE -ne 0) { throw "No se pudo seleccionar el proyecto GCP." } }
Invoke-Step "Seed: inicializar backend remoto" { Invoke-Terraform $seedDir @("init", "-input=false", "-reconfigure") }

$seedResources = Get-TerraformState $seedDir
if ($seedResources -notcontains "google_storage_bucket.terraform_state") {
  Invoke-Step "Seed: adoptar bucket de estado existente" { Invoke-Terraform $seedDir @("import", "-input=false", "google_storage_bucket.terraform_state", $stateBucket) }
}
if ($seedResources -notcontains "google_storage_bucket.velero") {
  Invoke-Step "Seed: adoptar bucket de Velero existente" { Invoke-Terraform $seedDir @("import", "-input=false", "google_storage_bucket.velero", $veleroBucket) }
}

Invoke-Step "Seed: validar" { Invoke-Terraform $seedDir @("validate") }
if ($Apply) {
  Invoke-Step "Seed: aplicar recursos persistentes" { Invoke-Terraform $seedDir @("apply", "-input=false", "-auto-approve") }
}
else {
  Invoke-Step "Seed: revisar plan sin aplicar" { Invoke-Terraform $seedDir @("plan", "-input=false") }
  Write-Host "Verificación completada; use -Apply para continuar con el bootstrap." -ForegroundColor Yellow
  exit 0
}

Invoke-Step "App: inicializar backend remoto" { Invoke-Terraform $appDir @("init", "-input=false", "-reconfigure") }
Import-ExistingClusterIfNeeded
Invoke-Step "App: validar" { Invoke-Terraform $appDir @("validate") }

$cidrArg = "-var=master_authorized_cidr=$MasterAuthorizedCidr"
$countArg = "-var=node_count=$NodeCount"
Invoke-Step "App: provisionar o reconciliar GKE y el node pool" {
  Invoke-Terraform $appDir @(
    "apply", "-input=false", "-auto-approve",
    "-target=google_project_service.container",
    "-target=google_container_cluster.comicrent",
    "-target=google_container_node_pool.primary",
    $cidrArg, $countArg
  )
}
Invoke-Step "App: instalar ArgoCD, clave de Sealed Secrets y app-of-apps" {
  Invoke-Terraform $appDir @("apply", "-input=false", "-auto-approve", $cidrArg, $countArg)
}
Invoke-Step "Contexto Kubernetes" { & gcloud container clusters get-credentials $ClusterName --zone $Zone --project $ProjectId; if ($LASTEXITCODE -ne 0) { throw "No se pudo cargar el contexto de Kubernetes." } }

Write-Host "Esperando ArgoCD y las aplicaciones GitOps de P9..." -ForegroundColor Cyan
& kubectl wait --for=condition=Available deployment/argocd-server -n argocd --timeout=10m
if ($LASTEXITCODE -ne 0) { throw "argocd-server no quedó disponible." }
$requiredSyncedApps = @("comicrent-p9", "cluster-governance", "velero", "sealed-secrets", "kyverno-policies", "argo-rollouts", "comicrent-p9-workloads")
# Kyverno 3.9.1 has pre-delete Helm hook Jobs that remain absent while the
# chart is healthy. Workload health is checked directly below because the
# frequent CronJob runs can make the aggregate Argo health lag behind pods.
$requiredHealthyApps = @("comicrent-p9", "cluster-governance", "velero", "sealed-secrets", "kyverno", "kyverno-policies", "argo-rollouts")
$deadline = (Get-Date).AddMinutes(45)
$allReady = $false
do {
  $allReady = $true
  $apps = & kubectl get applications -n argocd -o json 2>$null | ConvertFrom-Json
  foreach ($name in $requiredSyncedApps) {
    $app = $apps.items | Where-Object { $_.metadata.name -eq $name } | Select-Object -First 1
    if ($null -eq $app -or $app.status.sync.status -ne "Synced") {
      $allReady = $false
      break
    }
  }
  if ($allReady) {
    foreach ($name in $requiredHealthyApps) {
      $app = $apps.items | Where-Object { $_.metadata.name -eq $name } | Select-Object -First 1
      if ($null -eq $app -or $app.status.health.status -ne "Healthy") {
        $allReady = $false
        break
      }
    }
  }
  if ($allReady) {
    $deployments = & kubectl get deployments -n sa-p9 -o json 2>$null | ConvertFrom-Json
    foreach ($deployment in $deployments.items) {
      $desired = [int]$deployment.spec.replicas
      $available = [int]$deployment.status.availableReplicas
      if ($available -lt $desired) { $allReady = $false; break }
    }
  }
  if ($allReady) {
    $statefulSets = & kubectl get statefulsets -n sa-p9 -o json 2>$null | ConvertFrom-Json
    foreach ($statefulSet in $statefulSets.items) {
      $desired = [int]$statefulSet.spec.replicas
      $ready = [int]$statefulSet.status.readyReplicas
      if ($ready -lt $desired) { $allReady = $false; break }
    }
  }
  if ($allReady) {
    $pvcs = & kubectl get pvc -n sa-p9 -o json 2>$null | ConvertFrom-Json
    if ($null -eq $pvcs -or $pvcs.items.Count -lt 2) { $allReady = $false }
    foreach ($pvc in $pvcs.items) {
      if ($pvc.status.phase -ne "Bound") { $allReady = $false; break }
    }
  }
  if ($allReady) {
    $rollout = & kubectl get rollout comicrent-api-gateway-rollout -n sa-p9 -o json 2>$null | ConvertFrom-Json
    if ($null -eq $rollout -or $rollout.status.phase -ne "Healthy") { $allReady = $false }
  }
  if ($allReady) {
    $sealedSecrets = & kubectl get sealedsecrets -n sa-p9 -o json 2>$null | ConvertFrom-Json
    if ($null -eq $sealedSecrets -or $sealedSecrets.items.Count -lt 3) { $allReady = $false }
    foreach ($sealedSecret in $sealedSecrets.items) {
      $synced = $sealedSecret.status.conditions | Where-Object { $_.type -eq "Synced" -and $_.status -eq "True" }
      if ($null -eq $synced) { $allReady = $false; break }
    }
  }
  if ($allReady) {
    $policies = & kubectl get clusterpolicies -o json 2>$null | ConvertFrom-Json
    $comicrentPolicies = @($policies.items | Where-Object { $_.metadata.name -like "comicrent-*" })
    if ($comicrentPolicies.Count -lt 4) { $allReady = $false }
    foreach ($policy in $comicrentPolicies) {
      $ready = $policy.status.conditions | Where-Object { $_.type -eq "Ready" -and $_.status -eq "True" }
      if ($null -eq $ready) { $allReady = $false; break }
    }
  }
  if ($allReady) {
    $storageLocation = & kubectl get backupstoragelocation default -n velero -o json 2>$null | ConvertFrom-Json
    if ($null -eq $storageLocation -or $storageLocation.status.phase -ne "Available") { $allReady = $false }
  }
  if (-not $allReady) { Start-Sleep -Seconds 15 }
} while (-not $allReady -and (Get-Date) -lt $deadline)
if (-not $allReady) {
  & kubectl get applications -n argocd -o wide
  & kubectl get pods -n sa-p9 -o wide
  throw "Las aplicaciones o workloads P9 no llegaron a estado listo dentro del límite."
}
Write-Host "Bootstrap completo: estado remoto, GKE, ArgoCD, aplicaciones GitOps, PVC, secretos, políticas, StatefulSets, Deployments, Velero y Rollout están listos." -ForegroundColor Green
