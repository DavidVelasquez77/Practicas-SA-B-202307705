param(
    [string]$Namespace = "sa-p5",
    [string]$Release = "comicrent"
)

$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "============================================================"
Write-Host " COMICRENT - VERIFICACION DEL CLUSTER"
Write-Host "============================================================"

Write-Host ""
Write-Host "=== NAMESPACE ==="

kubectl get namespace $Namespace

Write-Host ""
Write-Host "=== PODS ==="

kubectl get pods -n $Namespace -o wide

Write-Host ""
Write-Host "=== DEPLOYMENTS ==="

kubectl get deployments -n $Namespace

Write-Host ""
Write-Host "=== STATEFULSETS ==="

kubectl get statefulsets -n $Namespace

Write-Host ""
Write-Host "=== SERVICES ==="

kubectl get svc -n $Namespace

Write-Host ""
Write-Host "=== PVC ==="

kubectl get pvc -n $Namespace

Write-Host ""
Write-Host "=== HPA ==="

kubectl get hpa -n $Namespace

Write-Host ""
Write-Host "=== POD DISRUPTION BUDGETS ==="

kubectl get pdb -n $Namespace

Write-Host ""
Write-Host "=== NETWORK POLICIES ==="

kubectl get networkpolicy -n $Namespace

Write-Host ""
Write-Host "=== SERVICE ACCOUNTS ==="

kubectl get serviceaccounts -n $Namespace

Write-Host ""
Write-Host "=== ROLES ==="

kubectl get roles -n $Namespace

Write-Host ""
Write-Host "=== ROLE BINDINGS ==="

kubectl get rolebindings -n $Namespace

Write-Host ""
Write-Host "=== CRONJOBS ==="

kubectl get cronjobs -n $Namespace

Write-Host ""
Write-Host "=== RESOURCE QUOTA ==="

kubectl get resourcequota -n $Namespace

Write-Host ""
Write-Host "=== LIMIT RANGE ==="

kubectl get limitrange -n $Namespace

Write-Host ""
Write-Host "=== METRICAS ==="

kubectl top pods -n $Namespace

Write-Host ""
Write-Host "=== COLAS RABBITMQ ==="

kubectl exec `
    -n $Namespace `
    comicrent-rabbitmq-0 `
    -- rabbitmqctl list_queues `
        name `
        durable `
        messages_ready `
        messages_unacknowledged `
        consumers

Write-Host ""
Write-Host "=== HELM STATUS ==="

helm status $Release

Write-Host ""
Write-Host "=== HELM HISTORY ==="

helm history $Release

Write-Host ""
Write-Host "============================================================"
Write-Host " VERIFICACION TERMINADA"
Write-Host "============================================================"