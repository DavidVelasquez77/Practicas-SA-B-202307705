param(
    [Parameter(Mandatory = $true)]
    [string]$ChartVersion,

    [Parameter(Mandatory = $true)]
    [string]$AppVersion
)

$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
$P5Root = Resolve-Path (Join-Path $ScriptDir "..")
$ChartFile = Join-Path $P5Root "helm\comicrent\Chart.yaml"

if (-not (Test-Path $ChartFile)) {
    throw "No existe $ChartFile"
}

Write-Host ""
Write-Host "============================================================"
Write-Host " ComicRent - Cambio de version"
Write-Host "============================================================"

Write-Host ""
Write-Host "Version actual:"

Get-Content $ChartFile |
    Select-String "^version:|^appVersion:"

$content = Get-Content $ChartFile -Raw

$content = $content -replace `
    '(?m)^version:\s*.*$', `
    "version: $ChartVersion"

$content = $content -replace `
    '(?m)^appVersion:\s*.*$', `
    "appVersion: `"$AppVersion`""

Set-Content `
    -Path $ChartFile `
    -Value $content `
    -Encoding UTF8

Write-Host ""
Write-Host "Nueva version:"

Get-Content $ChartFile |
    Select-String "^version:|^appVersion:"

Write-Host ""
Write-Host "Ejecutando helm lint..."

$ChartDir = Split-Path $ChartFile

Push-Location $ChartDir

try {

    helm lint . -f values-dev.yaml

    if ($LASTEXITCODE -ne 0) {
        throw "La nueva version produjo un chart invalido."
    }

}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Cambio de version finalizado."
Write-Host ""
Write-Host "Ahora puedes ejecutar:"
Write-Host ".\scripts\helm-upgrade.ps1"