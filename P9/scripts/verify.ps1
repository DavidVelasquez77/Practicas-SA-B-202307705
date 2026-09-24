[CmdletBinding()]
param(
  [string]$Namespace = "sa-p9",
  [switch]$TerraformPlan
)

$ErrorActionPreference = "Stop"
$script:Failures = [System.Collections.Generic.List[string]]::new()
$script:Warnings = [System.Collections.Generic.List[string]]::new()
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path

function Write-Check([string]$Label, [scriptblock]$Check) {
  try {
    $detail = & $Check
    Write-Host "[OK]    $Label$(if ($detail) { ": $detail" })" -ForegroundColor Green
  }
  catch {
    $script:Failures.Add("$Label - $($_.Exception.Message)")
    Write-Host "[FALLA] $Label - $($_.Exception.Message)" -ForegroundColor Red
  }
}

function Write-WarningCheck([string]$Label, [scriptblock]$Check) {
  try {
    $detail = & $Check
    Write-Host "[OK]    $Label$(if ($detail) { ": $detail" })" -ForegroundColor Green
  }
  catch {
    $script:Warnings.Add("$Label - $($_.Exception.Message)")
    Write-Host "[AVISO] $Label - $($_.Exception.Message)" -ForegroundColor Yellow
  }
}

function Get-KubectlJson([string[]]$Arguments) {
  $result = & kubectl @Arguments
  if ($LASTEXITCODE -ne 0) { throw "kubectl $($Arguments -join ' ') fallo." }
  return ($result | ConvertFrom-Json)
}

function Get-Terraform([string]$Directory, [string[]]$Arguments) {
  Push-Location $Directory
  try {
    & terraform @Arguments
    $code = $LASTEXITCODE
    if ($code -ne 0) { throw "terraform $($Arguments -join ' ') termino con codigo $code." }
  }
  finally { Pop-Location }
}

Write-Host "Verificacion de solo lectura para Practica 9" -ForegroundColor Cyan
Write-Host "Contexto Kubernetes: $(& kubectl config current-context)"

Write-Check "Acceso al cluster y nodos Ready" {
  $nodes = Get-KubectlJson @("get", "nodes", "-o", "json")
  $ready = @($nodes.items | Where-Object { ($_.status.conditions | Where-Object type -eq "Ready").status -eq "True" })
  if ($ready.Count -eq 0) { throw "No hay nodos Ready." }
  "$($ready.Count)/$($nodes.items.Count) nodos Ready"
}

Write-Check "ArgoCD Applications principales Synced/Healthy" {
  $apps = Get-KubectlJson @("get", "applications", "-n", "argocd", "-o", "json")
  $required = @("comicrent-p9", "comicrent-p9-workloads", "cluster-governance", "velero", "sealed-secrets", "kyverno-policies", "argo-rollouts")
  foreach ($name in $required) {
    $app = $apps.items | Where-Object { $_.metadata.name -eq $name } | Select-Object -First 1
    if ($null -eq $app) { throw "No existe la aplicacion $name." }
    if ($app.status.sync.status -ne "Synced" -or $app.status.health.status -ne "Healthy") {
      throw "$name esta $($app.status.sync.status)/$($app.status.health.status)."
    }
  }
  "$($required.Count) aplicaciones"
}

Write-WarningCheck "Estado del chart Kyverno" {
  $apps = Get-KubectlJson @("get", "applications", "-n", "argocd", "-o", "json")
  $app = $apps.items | Where-Object { $_.metadata.name -eq "kyverno" } | Select-Object -First 1
  if ($null -eq $app) { throw "No existe la aplicacion kyverno." }
  if ($app.status.health.status -ne "Healthy") { throw "Salud $($app.status.health.status)." }
  if ($app.status.sync.status -ne "Synced") { throw "Sincronizacion $($app.status.sync.status); revisar el diff del chart." }
  "Synced/Healthy"
}

Write-Check "Deployments y StatefulSets disponibles" {
  $deployments = Get-KubectlJson @("get", "deployments", "-n", $Namespace, "-o", "json")
  if ($deployments.items.Count -eq 0) { throw "No hay Deployments en $Namespace." }
  foreach ($item in $deployments.items) {
    if ([int]$item.status.availableReplicas -lt [int]$item.spec.replicas) { throw "$($item.metadata.name): $($item.status.availableReplicas)/$($item.spec.replicas) disponibles." }
  }
  $sets = Get-KubectlJson @("get", "statefulsets", "-n", $Namespace, "-o", "json")
  foreach ($item in $sets.items) {
    if ([int]$item.status.readyReplicas -lt [int]$item.spec.replicas) { throw "$($item.metadata.name): $($item.status.readyReplicas)/$($item.spec.replicas) listos." }
  }
  "$($deployments.items.Count) Deployments; $($sets.items.Count) StatefulSets"
}

Write-Check "PVC persistentes Bound" {
  $pvcs = Get-KubectlJson @("get", "pvc", "-n", $Namespace, "-o", "json")
  if ($pvcs.items.Count -eq 0) { throw "No hay PVC en $Namespace." }
  $unbound = @($pvcs.items | Where-Object { $_.status.phase -ne "Bound" })
  if ($unbound.Count) { throw (($unbound | ForEach-Object { $_.metadata.name + "=" + $_.status.phase }) -join ", ") }
  "$($pvcs.items.Count) PVC Bound"
}

Write-Check "PDB configurados" {
  $pdbs = Get-KubectlJson @("get", "pdb", "-n", $Namespace, "-o", "json")
  if ($pdbs.items.Count -eq 0) { throw "No hay PodDisruptionBudgets." }
  $gatewayPdb = $pdbs.items | Where-Object { $_.metadata.name -like "*api-gateway" } | Select-Object -First 1
  if ($null -eq $gatewayPdb) { throw "No existe el PDB del api-gateway." }
  $rollout = Get-KubectlJson @("get", "rollout", "comicrent-api-gateway-rollout", "-n", $Namespace, "-o", "json")
  $expected = [int]$gatewayPdb.status.expectedPods
  $healthy = [int]$gatewayPdb.status.currentHealthy
  $desired = [int]$gatewayPdb.status.desiredHealthy
  $replicas = [int]$rollout.spec.replicas
  if ($expected -lt $replicas) { throw "El PDB del gateway selecciona $expected pods; se esperaban al menos $replicas." }
  if ($healthy -lt $desired) { throw "El PDB del gateway solo ve $healthy pods sanos; requiere $desired." }
  "$($pdbs.items.Count) PDB; gateway $healthy/$expected protegidos, $($gatewayPdb.status.disruptionsAllowed) interrupciones permitidas"
}

Write-Check "Rollout Canary Healthy al 100%" {
  $rollout = Get-KubectlJson @("get", "rollout", "comicrent-api-gateway-rollout", "-n", $Namespace, "-o", "json")
  if ($rollout.status.phase -ne "Healthy") { throw "fase $($rollout.status.phase)." }
  if ([int]$rollout.status.currentStepIndex -lt 10) { throw "paso $($rollout.status.currentStepIndex)/10." }
  if ([int]$rollout.status.readyReplicas -lt [int]$rollout.spec.replicas) { throw "replicas Ready $($rollout.status.readyReplicas)/$($rollout.spec.replicas)." }
  "paso $($rollout.status.currentStepIndex)/10; $($rollout.status.readyReplicas)/$($rollout.spec.replicas) replicas"
}

Write-Check "SealedSecrets sincronizados" {
  $items = Get-KubectlJson @("get", "sealedsecrets", "-n", $Namespace, "-o", "json")
  if ($items.items.Count -lt 3) { throw "Se esperaban al menos 3; hay $($items.items.Count)." }
  foreach ($item in $items.items) {
    $condition = $item.status.conditions | Where-Object { $_.type -eq "Synced" -and $_.status -eq "True" }
    if ($null -eq $condition) { throw "$($item.metadata.name) no esta Synced." }
  }
  "$($items.items.Count) secretos"
}

Write-Check "Llave persistente de Sealed Secrets en Secret Manager" {
  foreach ($secret in @("comicrent-p9-sealed-secrets-tls-crt", "comicrent-p9-sealed-secrets-tls-key")) {
    $versions = & gcloud secrets versions list $secret --project comicrent-p6-2026 --format=json 2>$null | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar Secret Manager para $secret." }
    if (-not @($versions | Where-Object { $_.state -eq "ENABLED" }).Count) { throw "$secret no tiene versiones habilitadas." }
  }
  "2 secretos con versiones habilitadas; sus valores no se muestran"
}

Write-Check "Politicas Kyverno Ready" {
  $items = Get-KubectlJson @("get", "clusterpolicies", "-o", "json")
  $policies = @($items.items | Where-Object { $_.metadata.name -like "comicrent-*" })
  if ($policies.Count -lt 4) { throw "Se esperaban 4; hay $($policies.Count)." }
  foreach ($policy in $policies) {
    if (-not ($policy.status.conditions | Where-Object { $_.type -eq "Ready" -and $_.status -eq "True" })) { throw "$($policy.metadata.name) no esta Ready." }
  }
  "$($policies.Count) politicas Ready"
}

Write-Check "Velero: almacenamiento Available y schedule Enabled" {
  $location = Get-KubectlJson @("get", "backupstoragelocation", "default", "-n", "velero", "-o", "json")
  if ($location.status.phase -ne "Available") { throw "BackupStorageLocation esta $($location.status.phase)." }
  $schedules = Get-KubectlJson @("get", "schedules", "-n", "velero", "-o", "json")
  $enabled = @($schedules.items | Where-Object { -not $_.spec.paused })
  if ($enabled.Count -eq 0) { throw "No hay schedules de backup habilitados." }
  "$($enabled.Count) schedule(s) habilitado(s)"
}

Write-Check "Endpoint /health responde HTTP 200" {
  $service = Get-KubectlJson @("get", "service", "comicrent-p9-workloads-api-gateway", "-n", $Namespace, "-o", "json")
  $ip = $service.status.loadBalancer.ingress[0].ip
  if ([string]::IsNullOrWhiteSpace($ip)) { throw "El LoadBalancer aun no tiene IP externa." }
  $response = Invoke-WebRequest -UseBasicParsing -Uri "http://${ip}:3000/health" -TimeoutSec 15
  if ([int]$response.StatusCode -ne 200) { throw "HTTP $($response.StatusCode)." }
  "http://${ip}:3000/health"
}

foreach ($tier in @("seed", "app")) {
  $directory = Join-Path $repoRoot "P9/terraform/$tier"
  Write-Check "Terraform $tier validate" { Get-Terraform $directory @("validate", "-no-color"); "valido" }
  if ($TerraformPlan) {
    Write-Check "Terraform $tier plan sin cambios" {
      Push-Location $directory
      try {
        if ($tier -eq "app") {
          $cluster = & gcloud container clusters describe comicrent-gke-p6 --zone us-central1-a --project comicrent-p6-2026 --format=json | ConvertFrom-Json
          if ($LASTEXITCODE -ne 0) { throw "No se pudo leer el cluster para obtener el CIDR autorizado." }
          $cidr = $cluster.masterAuthorizedNetworksConfig.cidrBlocks[0].cidrBlock
          if ([string]::IsNullOrWhiteSpace($cidr)) { throw "El cluster no tiene un CIDR autorizado legible." }
          & terraform plan -input=false -detailed-exitcode -no-color "-var=master_authorized_cidr=$cidr"
        }
        else {
          $account = (& gcloud config get account).Trim()
          if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($account)) { throw "No hay una cuenta gcloud activa para verificar el acceso de Secret Manager." }
          $member = if ($account.EndsWith(".gserviceaccount.com")) { "serviceAccount:$account" } else { "user:$account" }
          & terraform plan -input=false -detailed-exitcode -no-color "-var=secret_accessor_member=$member"
        }
        $code = $LASTEXITCODE
        if ($code -eq 1) { throw "terraform plan fallo." }
        if ($code -eq 2) { throw "hay cambios pendientes; revisar el plan antes de aplicar." }
        "sin cambios"
      }
      finally { Pop-Location }
    }
  }
}

Write-Host ""
if ($script:Warnings.Count) { Write-Host "$($script:Warnings.Count) aviso(s); revisar arriba." -ForegroundColor Yellow }
if ($script:Failures.Count) {
  Write-Host "Verificacion incompleta: $($script:Failures.Count) fallo(s)." -ForegroundColor Red
  exit 1
}
Write-Host "Verificacion completada sin fallos." -ForegroundColor Green
exit 0
