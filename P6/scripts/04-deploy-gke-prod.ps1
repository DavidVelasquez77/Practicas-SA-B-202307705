param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region = "us-central1",
    [string]$Zone = "us-central1-a",
    [string]$ClusterName = "comicrent-gke-p6",
    [string]$Repository = "comicrent",
    [string]$Tag = "1.0.0-gke",
    [string]$Namespace = "sa-p6",
    [switch]$NoHelmWait
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "gcloud"
Assert-Command "kubectl"
Assert-Command "helm"

$registry = "$Region-docker.pkg.dev/$ProjectId/$Repository"

Write-Section "Conectar kubectl al cluster"
Invoke-Checked "gcloud" @("container", "clusters", "get-credentials", $ClusterName, "--zone=$Zone", "--project=$ProjectId")

Write-Section "Resolver StorageClass real de GKE"
$storageClasses = (& kubectl get storageclass -o json | ConvertFrom-Json).items
if (-not $storageClasses) {
    throw "El cluster no reporto ninguna StorageClass."
}

$storageClass = $storageClasses |
    Where-Object {
        $_.metadata.annotations -and
        ($_.metadata.annotations.PSObject.Properties.Name -contains 'storageclass.kubernetes.io/is-default-class') -and
        $_.metadata.annotations.'storageclass.kubernetes.io/is-default-class' -eq "true"
    } |
    Select-Object -First 1

if (-not $storageClass) {
    $storageClass = $storageClasses | Select-Object -First 1
}

$storageClassName = $storageClass.metadata.name
Write-Host "StorageClass seleccionada por el cluster: $storageClassName"

Write-Section "Aplicar adaptacion cloud de NetworkPolicy"
$gkePolicyPath = Join-Path $script:P6Root "k8s\network-policies-gke.yaml"
if (Test-Path -LiteralPath $gkePolicyPath) {
    $dnsClusterIp = (& kubectl get service kube-dns --namespace kube-system -o jsonpath='{.spec.clusterIP}').Trim()
    if ([string]::IsNullOrWhiteSpace($dnsClusterIp)) {
        throw "No se pudo resolver el ClusterIP de kube-dns."
    }

    $gkePolicy = (Get-Content -LiteralPath $gkePolicyPath -Raw).Replace("<KUBE_DNS_CLUSTER_IP>", $dnsClusterIp)
    $gkePolicy | & kubectl apply -f - | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo aplicar la allowlist cloud de DNS."
    }
    Write-Host "Allowlist DNS aplicada al ClusterIP actual de kube-dns: $dnsClusterIp"
}

Write-Section "Verificar Secrets"
foreach ($secretName in @("comicrent-database-secret", "comicrent-rabbitmq-secret", "comicrent-auth-secret")) {
    Invoke-Checked "kubectl" @("get", "secret", $secretName, "--namespace", $Namespace)
}

Write-Section "Validar dependencias y chart"
Invoke-Checked "helm" @("dependency", "build", $script:ChartPath)
Invoke-Checked "helm" @(
    "lint", $script:ChartPath,
    "--values", $script:ValuesPath,
    "--set-string", "rabbitmq.image.registry=",
    "--set-string", "rabbitmq.image.repository=$registry/rabbitmq",
    "--set-string", "rabbitmq.persistence.storageClass=$storageClassName",
    "--set-string", "api-gateway.image.repository=$registry/api-gateway",
    "--set-string", "auth-service.image.repository=$registry/auth-service",
    "--set-string", "comics-service.image.repository=$registry/comics-service",
    "--set-string", "rentals-service.image.repository=$registry/rentals-service",
    "--set-string", "copies-service.image.repository=$registry/copies-service",
    "--set-string", "copies-consumer.image.repository=$registry/copies-service",
    "--set-string", "operations-jobs.image.repository=$registry/operations-jobs"
)

Write-Section "Desplegar ComicRent en GKE"
$helmArguments = @(
    "upgrade", "--install", "comicrent", $script:ChartPath,
    "--namespace", $Namespace, "--create-namespace",
    "--values", $script:ValuesPath,
    "--set-string", "rabbitmq.image.registry=",
    "--set-string", "rabbitmq.image.repository=$registry/rabbitmq",
    "--set-string", "rabbitmq.persistence.storageClass=$storageClassName",
    "--set-string", "api-gateway.image.repository=$registry/api-gateway",
    "--set-string", "auth-service.image.repository=$registry/auth-service",
    "--set-string", "comics-service.image.repository=$registry/comics-service",
    "--set-string", "rentals-service.image.repository=$registry/rentals-service",
    "--set-string", "copies-service.image.repository=$registry/copies-service",
    "--set-string", "copies-consumer.image.repository=$registry/copies-service",
    "--set-string", "operations-jobs.image.repository=$registry/operations-jobs"
)
if (-not $NoHelmWait) {
    $helmArguments += @("--wait", "--timeout", "15m")
}
Invoke-Checked "helm" $helmArguments

Write-Section "Esperar workloads"
foreach ($deployment in @(
    "comicrent-api-gateway",
    "comicrent-auth-service",
    "comicrent-comics-service",
    "comicrent-rentals-service",
    "comicrent-copies-service",
    "comicrent-copies-consumer",
    "comicrent-summary-consumer"
)) {
    Invoke-Checked "kubectl" @("rollout", "status", "deployment/$deployment", "--namespace", $Namespace, "--timeout=15m")
}

Invoke-Checked "kubectl" @("get", "pods", "-o", "wide", "--namespace", $Namespace)
Invoke-Checked "kubectl" @("get", "svc", "--namespace", $Namespace)
Invoke-Checked "kubectl" @("get", "pvc", "--namespace", $Namespace)

Write-Host "Despliegue completado. Espera la IP EXTERNAL del Service comicrent-api-gateway."
