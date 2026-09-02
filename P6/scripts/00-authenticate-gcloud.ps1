param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region = "us-central1"
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "gcloud"

Write-Section "Autenticacion y configuracion de Google Cloud"
Write-Host "Proyecto: $ProjectId"
Write-Host "Region de Artifact Registry: $Region"
Write-Host "Se abrira el navegador para que completes la autenticacion."

Invoke-Checked "gcloud" @("auth", "login")
Invoke-Checked "gcloud" @("auth", "application-default", "login")
Invoke-Checked "gcloud" @("config", "set", "project", $ProjectId)
Invoke-Checked "gcloud" @("services", "enable", "container.googleapis.com", "artifactregistry.googleapis.com")
Invoke-Checked "gcloud" @("auth", "configure-docker", "$Region-docker.pkg.dev", "--quiet")

Write-Host "Autenticacion completada. No se imprimieron credenciales."
