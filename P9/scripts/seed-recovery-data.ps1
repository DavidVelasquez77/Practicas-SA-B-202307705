[CmdletBinding()]
param(
  [string]$Namespace = "sa-p9",
  [string]$Marker = "P9-REAL-DATA-$(Get-Date -Format yyyyMMddHHmmss)"
)
$ErrorActionPreference = "Stop"
$secret = kubectl get secret comicrent-postgresql-secret -n $Namespace -o jsonpath='{.data.password}'
$password = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($secret))
$sql = "CREATE TABLE IF NOT EXISTS p9_recovery_probe (id integer primary key, marker text not null, created_at timestamptz not null default now()); INSERT INTO p9_recovery_probe(id, marker) VALUES (1, '$Marker') ON CONFLICT (id) DO UPDATE SET marker=EXCLUDED.marker, created_at=now();"
kubectl exec comicrent-postgresql-0 -n $Namespace -- env PGPASSWORD=$password psql -U comicrent_user -d auth_db -v ON_ERROR_STOP=1 -c $sql
if ($LASTEXITCODE -ne 0) { throw "No se pudo escribir el dato de prueba." }
Write-Host "Dato sembrado:" -ForegroundColor Green
kubectl exec comicrent-postgresql-0 -n $Namespace -- env PGPASSWORD=$password psql -U comicrent_user -d auth_db -Atc "SELECT id || '|' || marker FROM p9_recovery_probe WHERE id=1;"
