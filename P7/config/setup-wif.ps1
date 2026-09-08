# Ejecutar por el propietario o un operador autorizado en PowerShell. No crea llaves JSON.
# Crea WIF/SA/RBAC y muestra DOS VARIABLES NO SECRETAS para GitHub.
# No crea clústeres, no escala nodos y no modifica los Secrets de aplicaciones.
$ErrorActionPreference = 'Stop'
$p7Project = 'comicrent-p6-2026'
$p7Repository = 'DavidVelasquez77/Practicas-SA-B-202307705'
$p7Pool = 'github-p7'
$p7Provider = 'github'
$p7SaId = 'github-p7-deployer'
$p7SaEmail = "$p7SaId@$p7Project.iam.gserviceaccount.com"

function Invoke-P7Gcloud {
    param([string[]]$Arguments)
    & gcloud @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Falló gcloud; revisar el mensaje antes de continuar.' }
}

Get-Command gcloud, kubectl -ErrorAction Stop | Out-Null
$p7Active = & gcloud auth list --filter=status:ACTIVE --format='value(account)'
if ($LASTEXITCODE -ne 0 -or -not $p7Active) {
    throw 'Abre PowerShell y ejecuta gcloud auth login; luego vuelve a ejecutar este archivo.'
}
$p7RepoInfo = Invoke-RestMethod "https://api.github.com/repos/$p7Repository"
if ($p7RepoInfo.full_name -cne $p7Repository) { throw 'El repositorio cambió de nombre; revisar WIF.' }
$p7Number = (& gcloud projects describe $p7Project --format='value(projectNumber)').Trim()
if ($LASTEXITCODE -ne 0 -or $p7Number -notmatch '^\d+$') { throw 'No se pudo resolver el número de proyecto.' }

Invoke-P7Gcloud @('services','enable','iam.googleapis.com','iamcredentials.googleapis.com','sts.googleapis.com','container.googleapis.com',"--project=$p7Project")
$p7ExistingSa = & gcloud iam service-accounts list "--project=$p7Project" "--filter=email:$p7SaEmail" --format='value(email)'
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar Service Accounts.' }
if (-not $p7ExistingSa) {
    Invoke-P7Gcloud @('iam','service-accounts','create',$p7SaId,"--project=$p7Project",'--display-name=GitHub P7 Helm deployer')
}
$p7ExistingPool = & gcloud iam workload-identity-pools list --location=global "--project=$p7Project" "--filter=name~/$p7Pool`$" --format='value(name)'
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar pools WIF.' }
if (-not $p7ExistingPool) {
    Invoke-P7Gcloud @('iam','workload-identity-pools','create',$p7Pool,'--location=global',"--project=$p7Project",'--display-name=GitHub P7')
}
$p7Condition = "assertion.repository_id == '$($p7RepoInfo.id)' && assertion.repository_owner_id == '$($p7RepoInfo.owner.id)' && assertion.ref.startsWith('refs/tags/v') && assertion.event_name == 'push' && assertion.workflow_ref == '$p7Repository/.github/workflows/p7-cd.yml@' + assertion.ref"
$p7ProviderArgs = @('--location=global',"--project=$p7Project","--workload-identity-pool=$p7Pool",'--issuer-uri=https://token.actions.githubusercontent.com','--attribute-mapping=google.subject=assertion.sub,attribute.repository_id=assertion.repository_id',"--attribute-condition=$p7Condition")
$p7ExistingProvider = & gcloud iam workload-identity-pools providers list --location=global "--project=$p7Project" "--workload-identity-pool=$p7Pool" "--filter=name~/$p7Provider`$" --format='value(name)'
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron consultar providers WIF.' }
if ($p7ExistingProvider) {
    Invoke-P7Gcloud (@('iam','workload-identity-pools','providers','update-oidc',$p7Provider) + $p7ProviderArgs)
} else {
    Invoke-P7Gcloud (@('iam','workload-identity-pools','providers','create-oidc',$p7Provider) + $p7ProviderArgs)
}
$p7Principal = "principalSet://iam.googleapis.com/projects/$p7Number/locations/global/workloadIdentityPools/$p7Pool/attribute.repository_id/$($p7RepoInfo.id)"
Invoke-P7Gcloud @('iam','service-accounts','add-iam-policy-binding',$p7SaEmail,"--project=$p7Project",'--role=roles/iam.workloadIdentityUser',"--member=$p7Principal")
Invoke-P7Gcloud @('projects','add-iam-policy-binding',$p7Project,'--role=roles/container.clusterViewer',"--member=serviceAccount:$p7SaEmail",'--condition=None')
Invoke-P7Gcloud @('container','clusters','get-credentials','comicrent-gke-p6','--zone=us-central1-a',"--project=$p7Project")
(Get-Content (Join-Path $PSScriptRoot 'wif-access.yaml') -Raw).Replace('<DEPLOY_SERVICE_ACCOUNT>', $p7SaEmail) | & kubectl apply -f -
if ($LASTEXITCODE -ne 0) { throw 'Falló la configuración RBAC; revisar permisos del usuario propietario.' }

Write-Host 'Crear estas VARIABLES de Actions (no Secrets) en GitHub > Settings > Secrets and variables > Actions > Variables:'
Write-Host "GCP_WIF_PROVIDER=projects/$p7Number/locations/global/workloadIdentityPools/$p7Pool/providers/$p7Provider"
Write-Host "GCP_SERVICE_ACCOUNT=$p7SaEmail"
Write-Host "https://github.com/$p7Repository/settings/variables/actions"
Write-Host 'WIF puede tardar varios minutos en propagar. Mantener el pool GKE en 0 hasta estar listos para CD.'
