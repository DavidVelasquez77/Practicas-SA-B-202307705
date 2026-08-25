param(
    [Parameter(Mandatory = $true)]
    [int]$Revision,

    [string]$Release = "comicrent",

    [string]$Namespace = "sa-p5"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "============================================================"
Write-Host " ComicRent - Helm Rollback"
Write-Host "============================================================"
Write-Host "Release:  $Release"
Write-Host "Revision: $Revision"

Write-Host ""
Write-Host "=== HISTORIAL ANTES ==="

helm history $Release

if ($LASTEXITCODE -ne 0) {
    throw "No se pudo consultar helm history."
}

Write-Host ""
Write-Host "=== ROLLBACK A REVISION $Revision ==="

helm rollback $Release $Revision `
    --wait `
    --timeout 10m

if ($LASTEXITCODE -ne 0) {
    throw "El rollback fallo."
}

Write-Host ""
Write-Host "=== ROLLOUT STATUS ==="

kubectl rollout status `
    deployment/comicrent-api-gateway `
    -n $Namespace `
    --timeout=300s

Write-Host ""
Write-Host "=== HISTORIAL DESPUES ==="

helm history $Release

Write-Host ""
Write-Host "=== ESTADO FINAL ==="

helm status $Release

Write-Host ""
Write-Host "============================================================"
Write-Host " Rollback finalizado correctamente."
Write-Host "============================================================"