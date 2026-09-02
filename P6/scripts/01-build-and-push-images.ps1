param(
    [Parameter(Mandatory)][string]$ProjectId,
    [string]$Region = "us-central1",
    [string]$Repository = "comicrent",
    [string]$Tag = "1.0.0-gke"
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "gcloud"
Assert-Command "docker"

$registry = "$Region-docker.pkg.dev/$ProjectId/$Repository"

Write-Section "Preparar Artifact Registry privado"
Write-Host "Registry: $registry"

& gcloud artifacts repositories describe $Repository --location=$Region --project=$ProjectId 2>$null
if ($LASTEXITCODE -ne 0) {
    Invoke-Checked "gcloud" @(
        "artifacts", "repositories", "create", $Repository,
        "--repository-format=docker", "--location=$Region",
        "--description=Imagenes privadas de ComicRent P6",
        "--project=$ProjectId"
    )
}

Invoke-Checked "gcloud" @("auth", "configure-docker", "$Region-docker.pkg.dev", "--quiet")

$images = @(
    @{ Name = "api-gateway"; Context = (Join-Path $script:P4Root "api-gateway") },
    @{ Name = "auth-service"; Context = (Join-Path $script:P4Root "services\auth-service") },
    @{ Name = "comics-service"; Context = (Join-Path $script:P4Root "services\comics-service") },
    @{ Name = "rentals-service"; Context = (Join-Path $script:P4Root "services\rentals-service") },
    @{ Name = "copies-service"; Context = (Join-Path $script:P4Root "services\copies-service") },
    @{ Name = "operations-jobs"; Context = (Join-Path $script:P5Root "jobs") }
)

Write-Section "Construir y publicar imagenes privadas"
foreach ($image in $images) {
    $dockerfile = Join-Path $image.Context "Dockerfile.prod"
    if (-not (Test-Path -LiteralPath $dockerfile)) {
        throw "No existe Dockerfile.prod: $dockerfile"
    }

    $remoteImage = "$registry/$($image.Name):$Tag"
    Write-Host "Construyendo $($image.Name)..."
    Invoke-Checked "docker" @("build", "--file", $dockerfile, "--tag", $remoteImage, $image.Context)
    Invoke-Checked "docker" @("push", $remoteImage)
}

Write-Section "Copiar RabbitMQ al registry privado"
$rabbitTag = "3.13.5-debian-12-r1"
$rabbitLocal = "bitnamilegacy/rabbitmq:$rabbitTag"
$rabbitRemote = "$registry/rabbitmq:$rabbitTag"
Invoke-Checked "docker" @("pull", $rabbitLocal)
Invoke-Checked "docker" @("tag", $rabbitLocal, $rabbitRemote)
Invoke-Checked "docker" @("push", $rabbitRemote)

Write-Host "Imagenes privadas publicadas correctamente."
