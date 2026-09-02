param(
    [string]$Namespace = "sa-p6",
    [string]$DotEnvPath = (Join-Path $PSScriptRoot "..\..\P4\.env"),
    [string]$NeonUrlEndpoint = ""
)

. (Join-Path $PSScriptRoot "_common.ps1")
Assert-Command "kubectl"

function Read-SecretValue {
    param([Parameter(Mandatory)][string]$Prompt)

    do {
        $secureValue = Read-Host -Prompt $Prompt -AsSecureString
        $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureValue)
        try {
            $plainValue = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
        }
        finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
        }
    } while ([string]::IsNullOrWhiteSpace($plainValue))

    return $plainValue
}

function Normalize-PostgresUrl {
    param([Parameter(Mandatory)][string]$Url)

    if ($Url.StartsWith("postgres://")) {
        return "postgresql://" + $Url.Substring("postgres://".Length)
    }

    if ($Url.StartsWith("postgresql://") -or $Url.StartsWith("postgresql+psycopg://")) {
        return $Url
    }

    throw "La URL de Neon debe iniciar con postgres://, postgresql:// o postgresql+psycopg://."
}

function Convert-ToPsycopgUrl {
    param([Parameter(Mandatory)][string]$Url)

    $normalized = Normalize-PostgresUrl $Url
    if ($normalized.StartsWith("postgresql+psycopg://")) {
        return $normalized
    }

    return "postgresql+psycopg://" + $normalized.Substring("postgresql://".Length)
}

function ConvertTo-Base64 {
    param([Parameter(Mandatory)][string]$Value)

    return [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Value))
}

function Apply-KubernetesSecret {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][hashtable]$Data
    )

    $yaml = @(
        "apiVersion: v1",
        "kind: Secret",
        "metadata:",
        "  name: $Name",
        "  namespace: $Namespace",
        "type: Opaque",
        "data:"
    )

    foreach ($key in ($Data.Keys | Sort-Object)) {
        $yaml += "  ${key}: $(ConvertTo-Base64 $Data[$key])"
    }

    $yamlText = $yaml -join "`n"
    $yamlText | & kubectl apply -f - | Out-Host
    if ($LASTEXITCODE -ne 0) {
        throw "No se pudo aplicar el Secret '$Name'."
    }
}

function Read-DotEnv {
    param([Parameter(Mandatory)][string]$Path)

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    foreach ($line in (Get-Content -LiteralPath $Path)) {
        if ($line -match '^\s*([^#=]+?)\s*=\s*(.*)\s*$') {
            $values[$matches[1].Trim()] = $matches[2].Trim().Trim('"').Trim("'")
        }
    }

    return $values
}

function Get-ExistingSecretOrPrompt {
    param(
        [Parameter(Mandatory)][hashtable]$DotEnv,
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][string]$Prompt
    )

    $value = $DotEnv[$Name]
    if ([string]::IsNullOrWhiteSpace($value) -or $value -match '^(CHANGE_ME|REEMPLAZAR)') {
        return Read-SecretValue $Prompt
    }

    Write-Host "$Name se reutilizara desde P4/.env sin mostrar su valor."
    return $value
}

function Read-NeonUrlsFromEndpoint {
    param([Parameter(Mandatory)][string]$Endpoint)

    if ([string]::IsNullOrWhiteSpace($Endpoint)) {
        return @{}
    }

    $response = Invoke-RestMethod -Uri $Endpoint -Method Get
    $urls = @{}
    foreach ($name in @("auth_db", "comics_db", "copies_db", "rentals_db", "operations_db")) {
        $value = [string]$response.$name
        if ([string]::IsNullOrWhiteSpace($value)) {
            throw "La fuente local no devolvio la URL de Neon para $name."
        }
        $urls[$name] = $value
    }

    return $urls
}

Write-Section "Crear namespace y Secrets de ComicRent"
Write-Host "Los siguientes valores se capturaran directamente en esta terminal y no se mostraran:"
Write-Host "- Cinco URLs de Neon"
Write-Host "- Password de RabbitMQ"
Write-Host "- JWT secret"
Write-Host "- Encryption key"

$dotEnv = Read-DotEnv $DotEnvPath
$neonUrls = if ([string]::IsNullOrWhiteSpace($NeonUrlEndpoint)) {
    @{}
} else {
    Read-NeonUrlsFromEndpoint $NeonUrlEndpoint
}

& kubectl get namespace $Namespace 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Invoke-Checked "kubectl" @("create", "namespace", $Namespace)
}

$authUrl = Normalize-PostgresUrl $(if ($neonUrls.ContainsKey("auth_db")) { $neonUrls["auth_db"] } else { Read-SecretValue "Neon Project 1 - URL de auth_db" })
$comicsUrl = Normalize-PostgresUrl $(if ($neonUrls.ContainsKey("comics_db")) { $neonUrls["comics_db"] } else { Read-SecretValue "Neon Project 2 - URL de comics_db" })
$rentalsUrl = Convert-ToPsycopgUrl $(if ($neonUrls.ContainsKey("rentals_db")) { $neonUrls["rentals_db"] } else { Read-SecretValue "Neon Project 3 - URL de rentals_db" })
$copiesUrl = Convert-ToPsycopgUrl $(if ($neonUrls.ContainsKey("copies_db")) { $neonUrls["copies_db"] } else { Read-SecretValue "Neon Project 2 - URL de copies_db" })
$operationsUrl = Normalize-PostgresUrl $(if ($neonUrls.ContainsKey("operations_db")) { $neonUrls["operations_db"] } else { Read-SecretValue "Neon Project 3 - URL de operations_db" })

$rabbitPassword = Get-ExistingSecretOrPrompt $dotEnv "RABBITMQ_PASSWORD" "Password de RabbitMQ"
$jwtSecret = Get-ExistingSecretOrPrompt $dotEnv "AUTH_JWT_SECRET" "JWT secret"
$encryptionKey = Get-ExistingSecretOrPrompt $dotEnv "AUTH_ENCRYPTION_KEY" "Encryption key"

Apply-KubernetesSecret "comicrent-database-secret" @{
    "auth-database-url" = $authUrl
    "comics-database-url" = $comicsUrl
    "rentals-database-url" = $rentalsUrl
    "copies-database-url" = $copiesUrl
    "operations-database-url" = $operationsUrl
}

Apply-KubernetesSecret "comicrent-rabbitmq-secret" @{
    "rabbitmq-password" = $rabbitPassword
}

Apply-KubernetesSecret "comicrent-auth-secret" @{
    "JWT_SECRET" = $jwtSecret
    "ENCRYPTION_KEY" = $encryptionKey
}

Write-Host "Secrets aplicados. Solo se muestran sus nombres; los valores no se guardaron en disco."
