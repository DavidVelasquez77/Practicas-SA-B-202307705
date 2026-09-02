param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region = "us-central1",
    [string]$Zone = "us-central1-a",
    [string]$ClusterName = "comicrent-gke-p6",
    [string]$Repository = "comicrent",
    [string]$Namespace = "sa-p6",
    [switch]$DeleteArtifactRegistry,
    [switch]$ConfirmDestroy
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "gcloud"
Assert-Command "kubectl"
Assert-Command "helm"

if (-not $ConfirmDestroy) {
    throw "Esta operacion es destructiva. Vuelve a ejecutarla agregando -ConfirmDestroy."
}

Write-Section "Eliminar release y namespace de ComicRent"
& helm uninstall comicrent --namespace $Namespace --ignore-not-found 2>$null
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo desinstalar el release Helm."
}

& kubectl delete namespace $Namespace --ignore-not-found=true --wait=true
if ($LASTEXITCODE -ne 0) {
    throw "No se pudo eliminar el namespace $Namespace."
}

Write-Section "Eliminar cluster GKE"
Invoke-Checked "gcloud" @(
    "container", "clusters", "delete", $ClusterName,
    "--zone=$Zone", "--project=$ProjectId", "--quiet"
)

if ($DeleteArtifactRegistry) {
    Write-Section "Eliminar Artifact Registry"
    Invoke-Checked "gcloud" @(
        "artifacts", "repositories", "delete", $Repository,
        "--location=$Region", "--project=$ProjectId", "--quiet"
    )
}

Write-Warning "Los proyectos Neon no se eliminan con este script: revisa y elimina manualmente los tres proyectos desde Neon si ya no son necesarios."
Write-Host "Limpieza de GKE completada."
