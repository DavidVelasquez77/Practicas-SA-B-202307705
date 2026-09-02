param(
    [string]$Tag = "1.0.0-gke"
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "docker"
Assert-Command "helm"

$localImages = @(
    @{ Name = "api-gateway"; Context = (Join-Path $script:P4Root "api-gateway") },
    @{ Name = "auth-service"; Context = (Join-Path $script:P4Root "services\auth-service") },
    @{ Name = "comics-service"; Context = (Join-Path $script:P4Root "services\comics-service") },
    @{ Name = "rentals-service"; Context = (Join-Path $script:P4Root "services\rentals-service") },
    @{ Name = "copies-service"; Context = (Join-Path $script:P4Root "services\copies-service") },
    @{ Name = "operations-jobs"; Context = (Join-Path $script:P5Root "jobs") }
)

Write-Section "Construir localmente los Dockerfile.prod"
foreach ($image in $localImages) {
    $dockerfile = Join-Path $image.Context "Dockerfile.prod"
    if (-not (Test-Path -LiteralPath $dockerfile)) {
        throw "No existe Dockerfile.prod: $dockerfile"
    }

    $localTag = "comicrent/$($image.Name):$Tag"
    Write-Host "Construyendo $localTag..."
    Invoke-Checked "docker" @("build", "--file", $dockerfile, "--tag", $localTag, $image.Context)
}

Write-Section "Validar chart cloud sin desplegar"
Invoke-Checked "helm" @("dependency", "build", $script:ChartPath)

$helmOverrides = @(
    "--set-string", "rabbitmq.image.registry=local",
    "--set-string", "api-gateway.image.repository=comicrent/api-gateway",
    "--set-string", "auth-service.image.repository=comicrent/auth-service",
    "--set-string", "comics-service.image.repository=comicrent/comics-service",
    "--set-string", "rentals-service.image.repository=comicrent/rentals-service",
    "--set-string", "copies-service.image.repository=comicrent/copies-service",
    "--set-string", "copies-consumer.image.repository=comicrent/copies-service",
    "--set-string", "operations-jobs.image.repository=comicrent/operations-jobs"
)

Invoke-Checked "helm" (@("lint", $script:ChartPath, "--values", $script:ValuesPath) + $helmOverrides)

$templateArguments = @("template", "comicrent", $script:ChartPath, "--namespace", $script:Namespace, "--values", $script:ValuesPath) + $helmOverrides
& helm @templateArguments | Out-Null
if ($LASTEXITCODE -ne 0) {
    throw "Fallo el renderizado Helm."
}

Write-Host "Validacion local completada. No se creo ningun recurso cloud."
