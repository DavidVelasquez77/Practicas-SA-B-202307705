param(
    [string]$Tag = "1.0.0",

    # Ejemplo:
    # docker.io/davidvelasquez77
    [string]$Registry = "",

    [switch]$Push,

    [switch]$LoadMinikube
)

$ErrorActionPreference = "Stop"

# ============================================================
# RUTAS
# ============================================================

$ScriptDir = $PSScriptRoot
$P5Root = Resolve-Path (Join-Path $ScriptDir "..")
$PracticasRoot = Resolve-Path (Join-Path $P5Root "..")
$P4Root = Join-Path $PracticasRoot "P4"

Write-Host ""
Write-Host "============================================================"
Write-Host " ComicRent - Build de imagenes"
Write-Host "============================================================"
Write-Host "P4: $P4Root"
Write-Host "P5: $P5Root"
Write-Host "Tag: $Tag"

if ($Push -and [string]::IsNullOrWhiteSpace($Registry)) {
    throw "Debes especificar -Registry cuando utilices -Push."
}

# ============================================================
# IMAGENES
# ============================================================

$Images = @(
    @{
        Name = "api-gateway"
        LocalName = "comicrent/api-gateway"
        Context = Join-Path $P4Root "api-gateway"
    },
    @{
        Name = "auth-service"
        LocalName = "comicrent/auth-service"
        Context = Join-Path $P4Root "auth-service"
    },
    @{
        Name = "comics-service"
        LocalName = "comicrent/comics-service"
        Context = Join-Path $P4Root "comics-service"
    },
    @{
        Name = "rentals-service"
        LocalName = "comicrent/rentals-service"
        Context = Join-Path $P4Root "rentals-service"
    },
    @{
        Name = "copies-service"
        LocalName = "comicrent/copies-service"
        Context = Join-Path $P4Root "copies-service"
    },
    @{
        Name = "operations-jobs"
        LocalName = "comicrent/operations-jobs"
        Context = Join-Path $P5Root "jobs"
    }
)

foreach ($Image in $Images) {

    $LocalImage = "$($Image.LocalName):$Tag"

    Write-Host ""
    Write-Host "============================================================"
    Write-Host " BUILD: $($Image.Name)"
    Write-Host " Contexto: $($Image.Context)"
    Write-Host " Imagen: $LocalImage"
    Write-Host "============================================================"

    if (-not (Test-Path $Image.Context)) {
        throw "No existe el contexto: $($Image.Context)"
    }

    $Dockerfile = Join-Path $Image.Context "Dockerfile"

    if (-not (Test-Path $Dockerfile)) {
        throw "No existe Dockerfile en: $Dockerfile"
    }

    docker build `
        -t $LocalImage `
        $Image.Context

    if ($LASTEXITCODE -ne 0) {
        throw "Fallo docker build para $($Image.Name)"
    }

    # --------------------------------------------------------
    # Cargar a Minikube
    # --------------------------------------------------------

    if ($LoadMinikube) {

        Write-Host ""
        Write-Host "Cargando $LocalImage en Minikube..."

        minikube image load $LocalImage

        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo cargar $LocalImage en Minikube."
        }
    }

    # --------------------------------------------------------
    # Push a Registry
    # --------------------------------------------------------

    if ($Push) {

        $RemoteImage = "$Registry/$($Image.Name):$Tag"

        Write-Host ""
        Write-Host "Tag remoto: $RemoteImage"

        docker tag `
            $LocalImage `
            $RemoteImage

        if ($LASTEXITCODE -ne 0) {
            throw "No se pudo crear tag para $RemoteImage."
        }

        Write-Host "Push: $RemoteImage"

        docker push $RemoteImage

        if ($LASTEXITCODE -ne 0) {
            throw "Fallo docker push para $RemoteImage."
        }
    }
}

Write-Host ""
Write-Host "============================================================"
Write-Host " IMAGENES GENERADAS"
Write-Host "============================================================"

docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" |
    Select-String "comicrent|REPOSITORY"

Write-Host ""
Write-Host "Build finalizado correctamente."