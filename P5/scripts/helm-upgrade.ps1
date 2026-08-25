param(
    [string]$Release = "comicrent",
    [string]$Namespace = "sa-p5",
    [string]$Values = "values-dev.yaml"
)

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$P5Root = Resolve-Path (Join-Path $ScriptDir "..")
$ChartDir = Join-Path $P5Root "helm\comicrent"
$ValuesPath = Join-Path $ChartDir $Values

Write-Host ""
Write-Host "============================================================"
Write-Host " ComicRent - Helm Upgrade"
Write-Host "============================================================"
Write-Host "Release:   $Release"
Write-Host "Namespace: $Namespace"
Write-Host "Chart:     $ChartDir"
Write-Host "Values:    $ValuesPath"

if (-not (Test-Path $ValuesPath)) {
    throw "No existe $ValuesPath"
}

Push-Location $ChartDir

try {

    Write-Host ""
    Write-Host "=== 1. VERSION DEL CHART ==="

    Get-Content .\Chart.yaml |
        Select-String "^version:|^appVersion:"

    Write-Host ""
    Write-Host "=== 2. DEPENDENCIAS ==="

    helm dependency update . --skip-refresh

    if ($LASTEXITCODE -ne 0) {
        throw "helm dependency update fallo."
    }

    Write-Host ""
    Write-Host "=== 3. HELM LINT ==="

    helm lint . -f $Values

    if ($LASTEXITCODE -ne 0) {
        throw "helm lint fallo."
    }

    Write-Host ""
    Write-Host "=== 4. HISTORIAL ANTES ==="

    helm history $Release

    Write-Host ""
    Write-Host "=== 5. HELM UPGRADE ==="

    helm upgrade $Release . `
        -f $Values `
        --wait `
        --timeout 10m

    if ($LASTEXITCODE -ne 0) {
        throw "helm upgrade fallo."
    }

    Write-Host ""
    Write-Host "=== 6. ROLLOUT API GATEWAY ==="

    kubectl rollout status `
        deployment/comicrent-api-gateway `
        -n $Namespace `
        --timeout=300s

    Write-Host ""
    Write-Host "=== 7. HISTORIAL DESPUES ==="

    helm history $Release

    Write-Host ""
    Write-Host "=== 8. ESTADO DEL RELEASE ==="

    helm status $Release

    Write-Host ""
    Write-Host "============================================================"
    Write-Host " Upgrade finalizado correctamente."
    Write-Host "============================================================"

}
finally {

    Pop-Location
}