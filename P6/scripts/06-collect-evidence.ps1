param(
    [string]$Namespace = "sa-p6",
    [Parameter(Mandatory)][string]$PublicBaseUrl
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "kubectl"

$evidenceRoot = Join-Path $script:P6Root "evidence"
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

function Save-KubectlOutput {
    param(
        [Parameter(Mandatory)][string]$FileName,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    $output = & kubectl @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo capturar $FileName."
    }
    $output | Out-File -LiteralPath (Join-Path $evidenceRoot $FileName) -Encoding utf8
}

Write-Section "Capturar evidencias del cluster"
Save-KubectlOutput "pods.txt" @("get", "pods", "-o", "wide", "--namespace", $Namespace)
Save-KubectlOutput "services.txt" @("get", "svc", "--namespace", $Namespace)
Save-KubectlOutput "storage.txt" @("get", "pvc,storageclass", "--namespace", $Namespace)
Save-KubectlOutput "scaling-and-security.txt" @("get", "hpa,pdb,networkpolicy,resourcequota,limitrange", "--namespace", $Namespace)
Save-KubectlOutput "async-and-rbac.txt" @("get", "cronjobs,serviceaccounts,roles,rolebindings", "--namespace", $Namespace)
Save-KubectlOutput "helm-status.txt" @("get", "events", "--sort-by=.lastTimestamp", "--namespace", $Namespace)

try {
    $health = Invoke-WebRequest -Uri "$($PublicBaseUrl.TrimEnd('/'))/health" -UseBasicParsing
    @(
        "URL: $($PublicBaseUrl.TrimEnd('/'))/health",
        "StatusCode: $($health.StatusCode)",
        "CapturedAt: $([DateTime]::UtcNow.ToString('o'))",
        "Body:",
        $health.Content
    ) | Out-File -LiteralPath (Join-Path $evidenceRoot "public-health.txt") -Encoding utf8
}
catch {
    $_ | Out-File -LiteralPath (Join-Path $evidenceRoot "public-health-error.txt") -Encoding utf8
    throw
}

Write-Host "Evidencias guardadas en $evidenceRoot. Toma tambien capturas de GKE, Artifact Registry y la terminal con la URL publica."
