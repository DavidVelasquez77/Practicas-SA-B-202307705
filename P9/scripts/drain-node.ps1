[CmdletBinding()]
param(
  [string]$Namespace = "sa-p9",
  [string]$HealthUrl = ""
)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($HealthUrl)) {
  $ip = kubectl get svc -n $Namespace -l app.kubernetes.io/name=api-gateway -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'
  $HealthUrl = "http://${ip}:3000/health"
}
$node = kubectl get pods -n $Namespace -l app.kubernetes.io/name=api-gateway -o wide --no-headers |
  Where-Object { $_ -match 'Running' } | Select-Object -First 1 | ForEach-Object { ($_ -split '\s+')[6] }
if ([string]::IsNullOrWhiteSpace($node)) { throw "No se encontró un nodo con pods P9." }
Write-Host "Health antes del drenaje: $((Invoke-WebRequest -UseBasicParsing $HealthUrl).StatusCode)" -ForegroundColor Green
Write-Host "Drenando $node; el PDB y las réplicas del gateway deben conservar el servicio." -ForegroundColor Cyan
kubectl cordon $node
kubectl drain $node --ignore-daemonsets --delete-emptydir-data --pod-selector="app.kubernetes.io/name=api-gateway" --timeout=10m
if ($LASTEXITCODE -ne 0) { throw "El drenaje no terminó correctamente." }
kubectl get pods -n $Namespace -o wide
kubectl uncordon $node
Start-Sleep -Seconds 20
Write-Host "Health después del drenaje: $((Invoke-WebRequest -UseBasicParsing $HealthUrl).StatusCode)" -ForegroundColor Green
