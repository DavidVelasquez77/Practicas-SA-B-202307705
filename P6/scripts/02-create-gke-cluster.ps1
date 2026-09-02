param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region = "us-central1",
    [string]$Zone = "us-central1-a",
    [string]$ClusterName = "comicrent-gke-p6",
    [string]$MachineType = "e2-standard-2",
    [int]$NodeCount = 1
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "gcloud"
Assert-Command "kubectl"

if ($NodeCount -ne 1) {
    Write-Warning "La aclaracion del auxiliar indica usar 1 nodo; se recibio NodeCount=$NodeCount."
}

Write-Section "Crear cluster GKE"
Write-Host "Cluster: $ClusterName"
Write-Host "Zona: $Zone"
Write-Host "Nodos: $NodeCount"
Write-Host "Tipo de maquina: $MachineType"

Invoke-Checked "gcloud" @(
    "container", "clusters", "create", $ClusterName,
    "--project=$ProjectId", "--zone=$Zone", "--num-nodes=$NodeCount",
    "--machine-type=$MachineType", "--disk-type=pd-balanced", "--disk-size=20",
    "--release-channel=regular", "--enable-ip-alias", "--enable-network-policy",
    "--scopes=cloud-platform"
)

Invoke-Checked "gcloud" @("container", "clusters", "get-credentials", $ClusterName, "--zone=$Zone", "--project=$ProjectId")
Invoke-Checked "kubectl" @("get", "nodes", "-o", "wide")

Write-Host "Cluster creado y kubectl conectado."
Write-Host "La StorageClass se resolvera despues con kubectl; el nombre no se fija en el repositorio."
