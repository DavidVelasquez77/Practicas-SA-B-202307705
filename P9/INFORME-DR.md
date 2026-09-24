# Informe de la prueba de DR — Práctica 9

## 1. Objetivos declarados

Se fijó un **RTO máximo de 2 horas**, como objetivo de laboratorio para reconstruir la plataforma y devolver el servicio con el dato de prueba recuperado. Se fijó un **RPO máximo de 6 horas**, alineado con la frecuencia del schedule de Velero, que crea respaldos cada seis horas. Ambos objetivos se definieron antes de evaluar el simulacro.

## 2. Escenario ejecutado

Se validaron antes del cronómetro un backup Velero `Completed` sin errores ni advertencias, las versiones de la llave TLS en Secret Manager, el acceso al estado remoto y la salud inicial. El wrapper `P9/scripts/rebuild-dr.ps1` destruyó el estado Terraform `app` (GKE, node pool y bootstrap de ArgoCD); preservó `seed`, el backend remoto, el bucket externo de Velero y Secret Manager. Luego ejecutó `bootstrap.ps1`, esperó la reconciliación GitOps, restauró PostgreSQL desde el backup en un namespace aislado y promovió a `auth_db` activa únicamente el marcador validado. No se reemplazó la base activa completa.

## 3. Tiempos medidos

| Medición | Objetivo | Resultado | Evaluación |
|---|---:|---:|---|
| RTO, desde el inicio del destroy hasta el servicio y marcador recuperados | 02:00:00 | **00:31:48.361** | Cumplido; margen aproximado 01:28:11 |
| RPO, edad del backup al inicio del destroy | 06:00:00 | **00:03:00.542** | Cumplido |

El RTO comenzó `2026-09-24T00:00:51.5416209Z` y terminó `2026-09-24T00:32:39.9023391Z`. El backup `p9-final-dr-20260923-175716` se completó a `2026-09-23T23:57:51Z`, con cero errores y advertencias. El RTO incluye destroy, bootstrap, reconciliación y verificación de la plataforma, restore de Velero y lectura del marcador en la base activa; excluye el preflight y la creación del backup. La transcripción completa es [p9-reconstruction-20260923-175941.txt](evidence/p9-reconstruction-20260923-175941.txt).

## 4. Pérdida medida

En el simulacro completo se recuperó la fila escrita antes del backup: `1|P9-BEFORE-BACKUP-20260923-170945`. Un ensayo separado escribió una segunda fila después del backup, eliminó ambas filas de la tabla de prueba y restauró el volumen. Regresó la fila anterior al backup; la posterior no, como corresponde al punto respaldado. En ese ensayo, el backup terminó `2026-09-23T03:58:42Z`, la pérdida se simuló a `2026-09-23T04:06:42.9834611Z` y el RPO fue **00:08:00.983**. Este dato pertenece al ensayo separado; el RPO del simulacro completo es 3 minutos. La prueba verifica una fila de recuperación deliberada, no todos los datos funcionales de ComicRent.

## 5. Puntos únicos de fallo detectados

Una ejecución anterior quedó bloqueada por finalizers de Applications hijas de ArgoCD/Kyverno mientras se destruía el propio clúster. Se actualizó el wrapper para retirar primero el finalizer de la raíz, eliminarla y después retirar automáticamente los finalizers hijos; el simulacro final concluyó sin intervención manual. La recuperación también depende de que el operador tenga identidad y permisos GCP para el estado remoto, GKE, el bucket de Velero y Secret Manager. La pérdida simultánea de esos recursos persistentes o de sus permisos impediría reconstruir.

## 6. Brecha y plan

El simulacro final cumplió ambos objetivos. El ensayo separado de pérdida de datos midió un RPO de 8 minutos, también dentro de la meta de 6 horas. Se conservarán `seed`, los backups externos y las versiones de la llave; se mantendrán restringidos los permisos sobre Secret Manager y el estado remoto, y se repetirá la medición cuando cambien el bootstrap o el calendario de respaldos. La prueba no demuestra recuperación integral de todas las tablas de negocio ni disponibilidad durante la destrucción del clúster; esas capacidades requieren pruebas y objetivos de negocio específicos.
