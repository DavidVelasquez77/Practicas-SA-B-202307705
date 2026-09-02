Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$script:P6Root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$script:PracticasRoot = (Resolve-Path (Join-Path $script:P6Root "..")).Path
$script:P5Root = Join-Path $script:PracticasRoot "P5"
$script:P4Root = Join-Path $script:PracticasRoot "P4"
$script:ChartPath = Join-Path $script:P5Root "helm\comicrent"
$script:ValuesPath = Join-Path $script:P6Root "k8s\values-gke-prod.yaml"
$script:Namespace = "sa-p6"

# Google Cloud SDK en Windows puede estar instalado sin quedar en el PATH
# de las nuevas ventanas de PowerShell. Agregarlo aquí también permite que
# kubectl encuentre gke-gcloud-auth-plugin.exe.
$gcloudSdkBin = Join-Path $env:LOCALAPPDATA "Google\Cloud SDK\google-cloud-sdk\bin"
if (Test-Path (Join-Path $gcloudSdkBin "gcloud.cmd")) {
    $env:Path = "$gcloudSdkBin;$env:Path"
}

function Assert-Command {
    param([Parameter(Mandatory)][string]$Name)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "No se encontro '$Name'. Instala la herramienta y vuelve a ejecutar el script."
    }
}

function Write-Section {
    param([Parameter(Mandatory)][string]$Title)

    Write-Host ""
    Write-Host "============================================================"
    Write-Host " $Title"
    Write-Host "============================================================"
}

function Invoke-Checked {
    param(
        [Parameter(Mandatory)][string]$Command,
        [Parameter(Mandatory)][string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Fallo el comando '$Command'."
    }
}
