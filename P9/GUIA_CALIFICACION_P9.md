# Guía para la calificación — Práctica 9

Guía rápida basada en la sección **8.2, Detalle de la Calificación**, del enunciado. Trabaja desde `C:\Users\Vela\Desktop\SA\LAB\PRACTICAS` en PowerShell. Primero enseña la evidencia indicada; usa los comandos solo cuando el auxiliar quiera verificación en vivo.

## Antes de comenzar

Confirma el contexto y que la plataforma siga disponible:

```powershell
kubectl config current-context
pwsh -NoProfile -ExecutionPolicy Bypass -File P9/scripts/verify.ps1
```

Debe mostrar el contexto GKE de ComicRent P9 y finalizar sin fallos. No muestres valores de Secrets, contraseñas, llaves, archivos ADC ni contenido del estado Terraform. No ejecutes un `destroy` durante la calificación salvo que el auxiliar lo pida explícitamente y haya tiempo para reconstruir el clúster.

## 1. Habilidades — 40 puntos

### 1.1 Runbook de recuperación — 12 puntos

**Muestra:** [`RUNBOOK-DR.md`](RUNBOOK-DR.md), especialmente preparación del operador, orden seed/app, validaciones, restore y promoción del marcador. Complementa con [`scripts/rebuild-dr.ps1`](scripts/rebuild-dr.ps1), que automatiza el simulacro completo.

**Comando opcional, sin destruir recursos:** si el auxiliar pide comprobar el procedimiento, el bloque selecciona automáticamente el backup `Completed` más reciente, sin errores ni advertencias:

```powershell
$backupList = kubectl get backups -n velero -o json
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron listar los backups de Velero.' }
$backupObject = ($backupList | ConvertFrom-Json).items |
  Where-Object { $_.status.phase -eq 'Completed' -and [int]$_.status.errors -eq 0 -and [int]$_.status.warnings -eq 0 } |
  Sort-Object { [DateTimeOffset]::Parse($_.metadata.creationTimestamp) } -Descending |
  Select-Object -First 1
if (-not $backupObject) { throw 'No hay un backup Completed sin errores ni advertencias.' }
$backup = $backupObject.metadata.name
"Backup seleccionado: $backup"
$publicIp = (Invoke-RestMethod 'https://api.ipify.org').Trim()
$cidr = "$publicIp/32"
pwsh -NoProfile -ExecutionPolicy Bypass -File P9/scripts/rebuild-dr.ps1 -MasterAuthorizedCidr $cidr -BackupName $backup -PreflightOnly
```

El preflight valida backup, llave y estado; presenta el plan de destrucción de `app`, pero no lo aplica. Si el auxiliar solicita el simulacro destructivo completo y hay tiempo para reconstruir, ejecuta el mismo wrapper con `-DestroyApp` en lugar de `-PreflightOnly`. El wrapper restaura y verifica el marcador recuperado en la base activa:

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File P9/scripts/rebuild-dr.ps1 -MasterAuthorizedCidr $cidr -BackupName $backup -DestroyApp
```

Para hacer solo una restauración de Velero en un namespace aislado, sigue [`RUNBOOK-DR.md`, sección 3](RUNBOOK-DR.md#3-restaurar-y-verificar-postgresql-desde-velero). Esa prueba no reemplaza la base activa; el wrapper `rebuild-dr.ps1 -DestroyApp` es el flujo completo de reconstrucción y promoción del marcador.
### 1.2 Informe de la prueba de DR — 12 puntos

**Muestra:** [`INFORME-DR.md`](INFORME-DR.md). Está organizado en los seis campos requeridos: objetivos, escenario, tiempos, pérdida, puntos únicos de fallo y brecha/plan.

**Respaldo medido:** [`evidence/p9-reconstruction-20260923-175941.txt`](evidence/p9-reconstruction-20260923-175941.txt) contiene la transcripción del simulacro final. Inicio `2026-09-24T00:00:51.5416209Z`, fin `2026-09-24T00:32:39.9023391Z`, RTO **00:31:48.361** y RPO **00:03:00.542**. El backup fue `p9-final-dr-20260923-175716`; terminó sin errores ni advertencias.

```powershell
Get-Content P9/INFORME-DR.md
Select-String -Path P9/evidence/p9-reconstruction-20260923-175941.txt -Pattern 'Inicio RTO UTC|Backup validado|Dato recuperado y validado|Fin RTO UTC|RTO medido'
```

### 1.3 Diagrama del bootstrap — 6 puntos

**Muestra:** [diagrama PNG](evidence/Diagrama/DIAGRAMA-RebuildDR-comicrent-p9.png), también incrustado en [`README.md`](README.md#flujo-de-bootstrap-y-recuperación). Señala que el operador inicia una sola ejecución, Terraform reconstruye `app`, ArgoCD sincroniza GitOps y los recursos `seed`, GCS y Secret Manager persisten fuera del clúster.

### 1.4 Preguntas teóricas — 10 puntos

Explica las respuestas con la evidencia de este proyecto:

- **¿Qué se conserva al destruir el clúster?** El estado remoto, los buckets y la llave de Sealed Secrets residen en `seed`/GCS/Secret Manager; el estado `app` administra el clúster, el node pool y el bootstrap de ArgoCD.
- **¿Cómo se reconstruye sin pasos manuales intermedios?** `rebuild-dr.ps1` valida el preflight, destruye `app`, llama a `bootstrap.ps1`, espera app-of-apps, restaura el volumen y valida/promueve el marcador.
- **¿Qué pasa con los cambios del clúster declarados en GitOps?** ArgoCD compara el estado deseado del repositorio y el estado del clúster; reconcilia los recursos de las Applications hijas.
- **¿Cómo se recuperan los datos y cuál es el límite demostrado?** Velero restaura PostgreSQL desde GCS a un namespace aislado; se verifica una fila persistida y el wrapper promueve el marcador a `auth_db`. Se probó esa fila de recuperación, no la restauración integral de todos los datos de negocio.
- **¿Qué protege la disponibilidad ante el drain?** Tres réplicas del gateway, PDB, anti-afinidad y probes; la captura documenta HTTP 200 antes y después.
- **¿Qué significa el resultado de DR?** El simulacro final cumplió RTO 2 h y RPO 6 h. El ensayo separado midió un RPO de 8 minutos y mostró que la fila escrita después del backup no se recupera.

## 2. Conocimiento — 60 puntos

### 2.1 Bootstrap automatizado desde cero — 14 puntos

**Muestra:** [`scripts/bootstrap.ps1`](scripts/bootstrap.ps1), [`scripts/rebuild-dr.ps1`](scripts/rebuild-dr.ps1), el [diagrama](evidence/Diagrama/DIAGRAMA-RebuildDR-comicrent-p9.png) y la transcripción final. Terraform provisiona GKE e instala ArgoCD con la Application raíz `comicrent-p9`; ArgoCD levanta las Applications de `apps/p9`.

```powershell
kubectl get applications -n argocd -o wide
kubectl get nodes
```

Busca Applications `Synced/Healthy` y nodos `Ready`. El `verify.ps1` del inicio ofrece el resumen completo.

### 2.2 Estado remoto y disciplina de IaC — 8 puntos

**Muestra:** `P9/terraform/seed/main.tf`, `P9/terraform/app/main.tf` y [`terminal-p9-terraform-remote-state.png`](evidence/capturas/terminal-p9-terraform-remote-state.png). Los estados están en GCS, separados por `p9/seed` y `p9/app`; el código del repositorio no contiene el archivo de estado.

```powershell
terraform -chdir=P9/terraform/seed state list
terraform -chdir=P9/terraform/app state list
git ls-files P9 | Select-String 'terraform\.tfstate'
```

Los dos primeros muestran recursos del estado remoto; el último no debe devolver archivos.

### 2.3 Respaldo y restauración con Velero — 14 puntos

**Muestra:** [`terminal-p9-velero-schedule.png`](evidence/capturas/terminal-p9-velero-schedule.png), [`p9-backup-restore.txt`](evidence/p9-backup-restore.txt) y la fila Restauración de datos de la tabla 4.1 en README. Explica schedule cada seis horas, retención de 168 horas, volúmenes persistentes y bucket GCS externo.

```powershell
kubectl get schedule,backupstoragelocation -n velero
kubectl get backups -n velero --sort-by=.metadata.creationTimestamp
kubectl get podvolumerestores -n velero
```

La evidencia final incluye backup/restore `Completed`, cero errores y advertencias, y los `PodVolumeRestore` completos.

### 2.4 Continuidad de secretos — 8 puntos

**Muestra:** [`p9-secret-custody.txt`](evidence/p9-secret-custody.txt), [`terminal-p9-sealed-secrets.png`](evidence/capturas/terminal-p9-sealed-secrets.png) y la transcripción final. La llave TLS tiene versiones habilitadas en Secret Manager fuera del clúster y los SealedSecrets volvieron a sincronizarse tras reconstruir.

```powershell
kubectl get sealedsecrets -n sa-p9
kubectl get secrets -n sa-p9
```

Estos comandos muestran nombres/estado solamente. **No uses `-o yaml`, `-o json` ni `kubectl get secret ... -o jsonpath` en la pantalla del auxiliar**, porque revelarían datos codificados o credenciales.

### 2.5 Resiliencia ante pérdida de nodo — 8 puntos

**Muestra primero:** [`terminal-p9-node-drain-pdb.png`](evidence/capturas/terminal-p9-node-drain-pdb.png) y [`p9-node-drain.txt`](evidence/p9-node-drain.txt). Presenta el PDB, las réplicas y HTTP 200 antes/después del drenaje.

```powershell
kubectl get pdb -n sa-p9
kubectl get pods -n sa-p9 -o wide
kubectl get nodes
```

El script `P9/scripts/drain-node.ps1` cordona y drena un nodo; ejecútalo solo si el auxiliar solicita repetir la prueba y el entorno está listo para tolerar esa interrupción.

### 2.6 Restauración de datos verificada — 8 puntos

**Muestra:** [`terminal-p9-data-loss-rpo.png`](evidence/capturas/terminal-p9-data-loss-rpo.png), [`terminal-p9-restore-data-verified.png`](evidence/capturas/terminal-p9-restore-data-verified.png), [`terminal-p9-restore-active-db.png`](evidence/capturas/terminal-p9-restore-active-db.png) y la transcripción final. El marcador eliminado se recuperó desde el PVC de Velero y se verificó en la base activa.

Para consultar el marcador actual sin imprimir la contraseña:

```powershell
$encoded = kubectl -n sa-p9 get secret comicrent-postgresql-secret -o jsonpath='{.data.password}'
$dbPassword = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($encoded -join '').Trim()))
kubectl exec -n sa-p9 comicrent-postgresql-0 -c postgresql -- env "PGPASSWORD=$dbPassword" psql -X -U comicrent_user -d auth_db -Atc 'SELECT id || ''|'' || marker || ''|'' || created_at FROM public.p9_recovery_probe WHERE id=1;'
```

Debe aparecer el marcador `P9-BEFORE-BACKUP-20260923-170945`. No imprimas `$dbPassword`.

## Estado del entregable

El diagrama ya está en el README y la guía de evidencias. El video aún está pendiente: antes de entregar, reemplaza en README la carpeta de Drive por el enlace directo al archivo y cambia el minutaje planificado por los tiempos reales. No presentes la carpeta como si ya contuviera el video.
