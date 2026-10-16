[CmdletBinding()]
param(
  [string]$Namespace = "sa-p9",
  [string]$Context = "",
  [string]$HealthUrl = "",
  [ValidateRange(1, 15)][int]$PollSeconds = 2,
  [switch]$PreflightOnly,
  [switch]$Apply
)

$ErrorActionPreference = "Stop"
$targetAppNames = @(
  "api-gateway", "auth-service", "comics-service", "copies-consumer",
  "copies-service", "rentals-service", "summary-consumer", "cron-summary", "cron-tick"
)
$podSelector = "app.kubernetes.io/name in (" + ($targetAppNames -join ",") + ")"
$started = $false
$drainJob = $null
$monitorJob = $null
$samples = [System.Collections.Generic.List[object]]::new()

function Invoke-Kubectl {
  param([Parameter(Mandatory)][string[]]$KubectlArguments)
  $allArguments = @()
  if (-not [string]::IsNullOrWhiteSpace($Context)) { $allArguments += @("--context", $Context) }
  $allArguments += $KubectlArguments
  $output = & kubectl @allArguments 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "kubectl $($KubectlArguments -join ' ') falló: $($output -join "`n")"
  }
  return ($output -join "`n").Trim()
}

function Get-KubeJson {
  param([Parameter(Mandatory)][string[]]$KubectlArguments)
  $raw = Invoke-Kubectl -KubectlArguments ($KubectlArguments + @("-o", "json"))
  if ([string]::IsNullOrWhiteSpace($raw)) { throw "kubectl no devolvió JSON: $($KubectlArguments -join ' ')" }
  return ($raw | ConvertFrom-Json)
}

function Test-PodReady {
  param($Pod)
  if ($Pod.status.phase -ne "Running") { return $false }
  $containers = @($Pod.status.containerStatuses)
  return ($containers.Count -gt 0 -and @($containers | Where-Object { -not $_.ready }).Count -eq 0)
}

function Test-PdbSelectsPod {
  param($Pdb, $Pod)
  $matchLabels = $Pdb.spec.selector.matchLabels
  if ($null -eq $matchLabels -or @($matchLabels.PSObject.Properties).Count -eq 0) { return $false }
  foreach ($label in $matchLabels.PSObject.Properties) {
    $podLabel = $Pod.metadata.labels.PSObject.Properties[$label.Name]
    if ($null -eq $podLabel -or $podLabel.Value -ne [string]$label.Value) { return $false }
  }
  return $true
}

function Test-HttpHealth {
  param([Parameter(Mandatory)][string]$Url)
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 8
    return [pscustomobject]@{
      Utc = [DateTimeOffset]::UtcNow.ToString("o")
      Status = [int]$response.StatusCode
      Error = ""
    }
  }
  catch {
    return [pscustomobject]@{
      Utc = [DateTimeOffset]::UtcNow.ToString("o")
      Status = 0
      Error = $_.Exception.Message
    }
  }
}

if (-not $PreflightOnly -and -not $Apply) {
  throw "No se modificó el clúster. Revise primero con -PreflightOnly y use -Apply para ejecutar el drenaje."
}

$contextText = if ($Context) { $Context } else { Invoke-Kubectl -KubectlArguments @("config", "current-context") }
Write-Host "Contexto Kubernetes: $contextText"

$nodes = Get-KubeJson -KubectlArguments @("get", "nodes")
$readyNodes = @($nodes.items | Where-Object {
  @($_.status.conditions | Where-Object { $_.type -eq "Ready" -and $_.status -eq "True" }).Count -gt 0
})
if ($readyNodes.Count -lt 3) { throw "La prueba requiere al menos tres nodos Ready; hay $($readyNodes.Count)." }

$pods = Get-KubeJson -KubectlArguments @("get", "pods", "-n", $Namespace)
$statefulPodNodes = @($pods.items | Where-Object {
  @($_.metadata.ownerReferences | Where-Object { $_.kind -eq "StatefulSet" }).Count -gt 0 -and $_.spec.nodeName
} | ForEach-Object { $_.spec.nodeName } | Sort-Object -Unique)
$readyGateways = @($pods.items | Where-Object {
  $_.metadata.labels.'app.kubernetes.io/name' -eq "api-gateway" -and (Test-PodReady $_)
})
if ($readyGateways.Count -lt 3) { throw "Se requieren tres réplicas Ready del gateway; hay $($readyGateways.Count)." }

$readyNodeNames = @($readyNodes | ForEach-Object { $_.metadata.name })
$gatewayNodeCandidates = @($readyGateways |
  Where-Object { $readyNodeNames -contains $_.spec.nodeName } |
  Group-Object { $_.spec.nodeName })
$preferredCandidates = @($gatewayNodeCandidates | Where-Object { $statefulPodNodes -notcontains $_.Name })
$candidatePool = if ($preferredCandidates.Count -gt 0) { $preferredCandidates } else { $gatewayNodeCandidates }
$candidate = $candidatePool | Sort-Object Count | Select-Object -First 1
if (-not $candidate) {
  throw "No hay un nodo Ready con una réplica del gateway."
}
$node = $candidate.Name
$targetPods = @($pods.items | Where-Object {
  $_.spec.nodeName -eq $node -and $targetAppNames -contains $_.metadata.labels.'app.kubernetes.io/name'
})
if ($targetPods.Count -eq 0) { throw "No hay cargas ComicRent para evacuar en $node." }

if ([string]::IsNullOrWhiteSpace($HealthUrl)) {
  $services = Get-KubeJson -KubectlArguments @("get", "services", "-n", $Namespace, "-l", "app.kubernetes.io/name=api-gateway")
  $service = $services.items | Where-Object { $_.spec.type -eq "LoadBalancer" } | Select-Object -First 1
  $address = $service.status.loadBalancer.ingress[0].ip
  if ([string]::IsNullOrWhiteSpace($address)) { $address = $service.status.loadBalancer.ingress[0].hostname }
  if ([string]::IsNullOrWhiteSpace($address)) { throw "El Service público del gateway aún no tiene IP/hostname; indique -HealthUrl si procede." }
  $HealthUrl = "http://${address}:3000/health"
}

$pdbs = Get-KubeJson -KubectlArguments @("get", "pdb", "-n", $Namespace)
$blockingPdbs = @()
$matchingPdbNames = [System.Collections.Generic.List[string]]::new()
foreach ($pdb in $pdbs.items) {
  $matched = @($targetPods | Where-Object { Test-PdbSelectsPod -Pdb $pdb -Pod $_ }).Count -gt 0
  if ($matched) {
    $matchingPdbNames.Add($pdb.metadata.name)
    if ([int]$pdb.status.disruptionsAllowed -lt 1) { $blockingPdbs += $pdb.metadata.name }
  }
}
if ($blockingPdbs.Count) { throw "Los PDB no permiten evacuar de forma segura: $($blockingPdbs -join ', ')" }

$remainingGateways = @($readyGateways | Where-Object { $_.spec.nodeName -ne $node })
if ($remainingGateways.Count -lt 2) { throw "El nodo elegido dejaría menos de dos réplicas Ready del gateway." }
$preHealth = Test-HttpHealth -Url $HealthUrl
if ($preHealth.Status -ne 200) { throw "Health previo no es HTTP 200: $($preHealth.Status) $($preHealth.Error)" }

Write-Host "Endpoint: $HealthUrl"
Write-Host "Health antes: HTTP $($preHealth.Status) a $($preHealth.Utc)"
Write-Host "Nodo seleccionado: $node"
Write-Host "Pods P9 que se evacuarán: $($targetPods.Count); selector: $podSelector"
Write-Host "PostgreSQL/RabbitMQ quedan fuera de la evacuación para preservar sus volúmenes singleton."
if ($statefulPodNodes -contains $node) { Write-Host "El nodo seleccionado aloja un StatefulSet; el selector lo deja ejecutándose en el nodo cordonado." }
Write-Host "Réplicas del gateway Ready que quedan en otros nodos: $($remainingGateways.Count)"
Write-Host "PDBs que protegen pods en el nodo: $(if ($matchingPdbNames.Count) { $matchingPdbNames -join ', ' } else { 'ninguno' })"

if ($PreflightOnly) {
  Write-Host "Preflight correcto. No se cordonó ni drenó ningún nodo."
  exit 0
}

$stopSignal = Join-Path ([System.IO.Path]::GetTempPath()) ("p9-drain-stop-" + [guid]::NewGuid().ToString("N"))
try {
  Invoke-Kubectl -KubectlArguments @("cordon", $node) | Write-Host
  $started = $true

  $monitorJob = Start-Job -ArgumentList $HealthUrl, $PollSeconds, $stopSignal -ScriptBlock {
    param($Url, $Interval, $StopFile)
    while (-not (Test-Path -LiteralPath $StopFile)) {
      $utc = [DateTimeOffset]::UtcNow.ToString("o")
      try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 8
        [pscustomobject]@{ Utc = $utc; Status = [int]$response.StatusCode; Error = "" }
      }
      catch {
        [pscustomobject]@{ Utc = $utc; Status = 0; Error = $_.Exception.Message }
      }
      Start-Sleep -Seconds $Interval
    }
  }
  Start-Sleep -Seconds $PollSeconds
  $drainStarted = [DateTimeOffset]::UtcNow
  $drainJob = Start-Job -ArgumentList $Context, $node, $podSelector -ScriptBlock {
    param($ContextName, $NodeName, $Selector)
    $arguments = @()
    if (-not [string]::IsNullOrWhiteSpace($ContextName)) { $arguments += @("--context", $ContextName) }
    $arguments += @("drain", $NodeName, "--ignore-daemonsets", "--delete-emptydir-data", "--pod-selector", $Selector, "--timeout=10m")
    & kubectl @arguments
    if ($LASTEXITCODE -ne 0) { throw "kubectl drain terminó con código $LASTEXITCODE." }
    "Drenaje de cargas ComicRent completado."
  }

  while ($drainJob.State -in @("NotStarted", "Running")) {
    foreach ($sample in @(Receive-Job -Job $monitorJob -ErrorAction SilentlyContinue)) { $samples.Add($sample) }
    Start-Sleep -Seconds 1
    $drainJob = Get-Job -Id $drainJob.Id
  }
  foreach ($sample in @(Receive-Job -Job $monitorJob -ErrorAction SilentlyContinue)) { $samples.Add($sample) }
  $drainOutput = @(Receive-Job -Job $drainJob -ErrorAction SilentlyContinue)
  $drainEnd = [DateTimeOffset]::UtcNow
  if ($drainJob.State -ne "Completed") {
    throw "El drenaje falló: $($drainOutput -join "`n")"
  }
  $drainOutput | ForEach-Object { Write-Host ([string]$_) }

  $podsDuring = Get-KubeJson -KubectlArguments @("get", "pods", "-n", $Namespace)
  $remainingOnNode = @($podsDuring.items | Where-Object {
    $_.spec.nodeName -eq $node -and $targetAppNames -contains $_.metadata.labels.'app.kubernetes.io/name' -and $_.status.phase -eq "Running"
  })
  if ($remainingOnNode.Count -gt 0) { throw "Quedaron $($remainingOnNode.Count) pods P9 en el nodo después del drenaje." }

  New-Item -ItemType File -Path $stopSignal -Force | Out-Null
  Stop-Job -Job $monitorJob -ErrorAction SilentlyContinue | Out-Null
  foreach ($sample in @(Receive-Job -Job $monitorJob -ErrorAction SilentlyContinue)) { $samples.Add($sample) }
  Remove-Job -Job $monitorJob -Force -ErrorAction SilentlyContinue
  $monitorJob = $null

  $duringSamples = @($samples | Where-Object {
    try {
      $sampleTime = [DateTimeOffset]::Parse($_.Utc, [Globalization.CultureInfo]::InvariantCulture)
      $sampleTime -ge $drainStarted -and $sampleTime -le $drainEnd
    } catch { $false }
  })
  if ($duringSamples.Count -eq 0) { throw "No se obtuvo una muestra HTTP durante el drenaje." }
  $duringFailures = @($duringSamples | Where-Object { [int]$_.Status -ne 200 })
  Write-Host "Duración del drenaje: $(($drainEnd - $drainStarted).ToString('c'))"
  Write-Host "Muestras HTTP durante el drenaje: $($duringSamples.Count); fallos: $($duringFailures.Count)"
  $duringSamples | ForEach-Object { Write-Host "  $($_.Utc) HTTP $($_.Status) $(if ($_.Error) { $_.Error })" }
  if ($duringFailures.Count -gt 0) { throw "El endpoint dejó de responder HTTP 200 durante el drenaje." }

  $postDrainHealth = Test-HttpHealth -Url $HealthUrl
  if ($postDrainHealth.Status -ne 200) { throw "Health después del drenaje no es HTTP 200: $($postDrainHealth.Status) $($postDrainHealth.Error)" }
  Write-Host "Health con cargas evacuadas: HTTP $($postDrainHealth.Status) a $($postDrainHealth.Utc)"
}
finally {
  if ($monitorJob) {
    New-Item -ItemType File -Path $stopSignal -Force -ErrorAction SilentlyContinue | Out-Null
    Stop-Job -Job $monitorJob -ErrorAction SilentlyContinue | Out-Null
    foreach ($sample in @(Receive-Job -Job $monitorJob -ErrorAction SilentlyContinue)) { $samples.Add($sample) }
    Remove-Job -Job $monitorJob -Force -ErrorAction SilentlyContinue
  }
  if ($drainJob) { Remove-Job -Job $drainJob -Force -ErrorAction SilentlyContinue }
  if ($started) {
    Invoke-Kubectl -KubectlArguments @("uncordon", $node) | Write-Host
    Invoke-Kubectl -KubectlArguments @("wait", "--for=condition=Ready", "node/$node", "--timeout=3m") | Write-Host
    $nodeStatus = Get-KubeJson -KubectlArguments @("get", "node", $node)
    if ($nodeStatus.spec.unschedulable -eq $true) { throw "El nodo $node quedó cordonado; no se completó la limpieza." }
  }
  Remove-Item -LiteralPath $stopSignal -Force -ErrorAction SilentlyContinue
}

$deadline = (Get-Date).AddMinutes(10)
$allReady = $false
while (-not $allReady -and (Get-Date) -lt $deadline) {
  $allReady = $true
  $deployments = Get-KubeJson -KubectlArguments @("get", "deployments", "-n", $Namespace)
  foreach ($deployment in $deployments.items) {
    if ([int]$deployment.status.availableReplicas -lt [int]$deployment.spec.replicas) { $allReady = $false; break }
  }
  if ($allReady) {
    $rollouts = Get-KubeJson -KubectlArguments @("get", "rollouts", "-n", $Namespace)
    foreach ($rollout in $rollouts.items) {
      if ([int]$rollout.status.readyReplicas -lt [int]$rollout.spec.replicas) { $allReady = $false; break }
    }
  }
  if ($allReady) { break }
  Start-Sleep -Seconds 5
}
if (-not $allReady) { throw "Las cargas ComicRent no recuperaron todas sus réplicas en 10 minutos." }

$finalHealth = Test-HttpHealth -Url $HealthUrl
if ($finalHealth.Status -ne 200) { throw "Health final no es HTTP 200: $($finalHealth.Status) $($finalHealth.Error)" }
Write-Host "Health final: HTTP $($finalHealth.Status) a $($finalHealth.Utc)"
Write-Host "Drenaje completado; nodo descordonado y cargas ComicRent listas."
