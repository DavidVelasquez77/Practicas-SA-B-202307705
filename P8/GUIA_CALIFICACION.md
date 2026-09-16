# Guía para la calificación - Práctica 8

Esta guía indica qué abrir, qué evidencia mostrar y qué explicar durante la calificación. La fuente principal de entrega continúa siendo el [`README.md`](README.md).

## Preparación antes de iniciar

1. Abrir el [README público](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/blob/main/P8/README.md) en la tabla de enlaces.
2. Abrir el [repositorio GitOps](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops) en otra pestaña.
3. Si la interfaz de ArgoCD no abre, ejecutar y mantener abierta esta terminal:

   ```bash
   kubectl -n argocd port-forward svc/argocd-server 8080:443
   ```

4. Verificar el estado final antes de la evaluación:

   ```bash
   kubectl -n argocd get applications \
     -o custom-columns="NAME:.metadata.name,SYNC:.status.sync.status,HEALTH:.status.health.status,REVISION:.status.sync.revision"

   kubectl get rollout comicrent-api-gateway-rollout -n sa-p8 \
     -o custom-columns="NAME:.metadata.name,PHASE:.status.phase,STEP:.status.currentStepIndex,AVAILABLE:.status.availableReplicas,STABLE:.status.stableRS,CURRENT:.status.currentPodHash"
   ```

   Resultado esperado: `comicrent-p8` en `Synced/Healthy` y el Rollout en `Healthy`, paso `10`, con los hashes estable y actual iguales.

## Orden recomendado para demostrar la práctica

### 1. Separación entre código y GitOps

Mostrar el repositorio de código y el repositorio GitOps independiente.

Explicar: "El repositorio de código contiene los microservicios, pruebas, charts y workflows. El repositorio GitOps contiene el estado deseado. GitHub Actions solo publica imágenes y abre un Pull Request de actualización; ArgoCD es el único componente que aplica los manifiestos de la aplicación al clúster."

Evidencia:

- [Repositorio de código](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705)
- [Repositorio GitOps](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops)
- [Workflow de CI](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/blob/main/.github/workflows/p8-ci.yml)
- [Workflow de release](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/blob/main/.github/workflows/p8-release.yml)

### 2. Pipeline y prohibición de despliegue directo

Abrir el [run exitoso 35036158704](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/35036158704).

Mostrar los jobs de compilación, pruebas, integración, Helm, Terraform y Trivy.

Explicar: "Los workflows no guardan kubeconfig y no ejecutan `kubectl apply`, `kubectl set image` ni `helm upgrade`. Comprometer el repositorio de código no concede acceso administrativo al clúster."

### 3. Terraform y Helm

Mostrar en el README las capturas de:

- `terraform validate`
- `terraform plan`
- `terraform apply -auto-approve`
- `helm list -A`
- `helm lint`

Explicar: "Terraform administra GKE, namespaces, cuotas, límites, RBAC, ArgoCD, Argo Rollouts, Kyverno, Sealed Secrets y el bootstrap de la aplicación. Helm empaqueta cada servicio y utiliza valores diferenciados por ambiente."

### 4. ArgoCD como fuente de reconciliación

Abrir `http://localhost:8080/applications` y seleccionar `comicrent-p8`.

Mostrar:

- Aplicación `comicrent-p8`.
- Namespace de ArgoCD: `argocd`.
- Namespace de destino: `sa-p8`.
- Repositorio GitOps y ruta `apps/comicrent`.
- Estado `Synced/Healthy`.
- Historial de sincronizaciones.

Explicar: "ArgoCD compara continuamente Git con el clúster. `selfHeal` corrige desviaciones y `prune` elimina recursos que dejaron de estar declarados."

### 5. Promoción Canary

Mostrar el manifiesto del `api-gateway` en el repositorio GitOps y señalar los pasos:

```text
10% -> AnalysisTemplate -> 25% -> AnalysisTemplate -> 50% -> AnalysisTemplate -> 100%
```

Explicar: "Los análisis intermedios ejecutan k6 contra `/health`. La promoción exige `http_req_failed: rate==0` y `p(95)<500ms`. k6 se usa como puerta interna del Canary; la prueba de carga independiente fue anulada por indicación del auxiliar."

### 6. Fallo inducido y reversión automática

Abrir:

- [Commit defectuoso befeba4](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/commit/befeba4e04c0f41ef71af7cce5edeafefe87475d)
- [AnalysisRun fallido y salida k6](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/blob/main/P8/evidence/canary-incident-2026-09-15.txt)
- [RolloutAborted y recuperación](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/blob/main/P8/evidence/canary-rollback.md)
- [Commit de restauración 6f907d5](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/commit/6f907d53ed859f58fc8286d53a588ced62f5b448)

Explicar: "El endpoint se cambió deliberadamente a `/definitely-not-health`. Las diez solicitudes fallaron, `http_req_failed` llegó a 100% y, como `failureLimit` era cero, Argo Rollouts abortó automáticamente en la etapa del 10%. El ReplicaSet estable siguió atendiendo al menos el 90% del tráfico. Argo Rollouts ejecutó la contención; ArgoCD sincronizó el cambio y posteriormente la restauración declarada en Git."

Si preguntan por la captura degradada: "Corresponde al momento del incidente. El estado final actual es `Synced/Healthy`; el recurso fallido se conserva como evidencia histórica."

### 7. Cadena de suministro

Abrir el [release exitoso v0.8.5](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34937258452) y mostrar:

- [SBOM SPDX de la imagen](evidence/sbom-api-gateway-v0.8.5.spdx.json)
- [Reporte Trivy](evidence/trivy-api-gateway-v0.8.5.json)
- [Salida real de Cosign verify](evidence/cosign-verify-api-gateway-v0.8.5.txt)
- Imagen firmada: `ghcr.io/davidvelasquez77/comicrent-api-gateway:v0.8.5`

Explicar: "La imagen tiene tag SemVer, Trivy encontró cero vulnerabilidades críticas, el SBOM registra sus componentes y Cosign verificó la identidad OIDC del workflow, la entrada de transparencia y el certificado."

### 8. Bloqueo temprano por Trivy

Abrir el [Pull Request #15](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/pull/15) y el [run fallido 35046489034](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/35046489034).

Explicar: "Se introdujo deliberadamente `nginx:latest`, ejecución privilegiada y ausencia de límites. Trivy devolvió código 1 y el Pull Request quedó bloqueado, por lo que el cambio nunca llegó al repositorio GitOps ni al clúster."

### 9. Kyverno y gestión de secretos

Mostrar las cuatro políticas:

```bash
kubectl get clusterpolicies
```

Explicar que se rechazan:

1. Imágenes con `latest`.
2. Contenedores sin requests y limits de CPU/memoria.
3. Contenedores que pueden ejecutarse como root.
4. Imágenes sin firma Cosign válida.

Abrir la [evidencia de rechazo de Kyverno](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/blob/main/P8/evidence/kyverno-cosign-rejected.txt).

Después mostrar:

```bash
kubectl -n sa-p8 get sealedsecret
```

Explicar: "Git almacena únicamente `SealedSecret` con `encryptedData`. La clave privada permanece fuera del repositorio y el controlador genera los Secrets dentro del clúster."

## Respuestas breves para preguntas teóricas

- **¿Quién despliega la aplicación?** ArgoCD. Terraform instala la plataforma y declara el `Application`; los workflows no despliegan al clúster.
- **¿Quién realiza la reversión?** Argo Rollouts aborta la revisión candidata y conserva el ReplicaSet estable. ArgoCD no decide el rollback.
- **¿Por qué ArgoCD apareció `Synced/Degraded` durante el incidente?** Git declaraba la revisión defectuosa, por lo que estaba sincronizado; el análisis fallido hacía que su salud estuviera degradada.
- **¿Por qué restaurar Git después del aborto?** Para que la fuente de verdad vuelva a declarar la configuración sana y ArgoCD quede `Synced/Healthy`.
- **¿Cuánto tráfico recibió la revisión defectuosa?** Como máximo 10%, porque el fallo ocurrió en la primera etapa y no avanzó al 25%.
- **¿Qué evita cambios manuales?** El repositorio GitOps, la reconciliación de ArgoCD con `selfHeal` y la ausencia de credenciales del clúster en GitHub Actions.
- **¿Qué evita imágenes no confiables?** Trivy antes de publicar, SBOM, firma Cosign y verificación de firma por Kyverno durante la admisión.
- **¿Por qué se usa SemVer?** Permite identificar y revertir versiones inmutables; `latest` está prohibido por el pipeline y Kyverno.

## Lista final de control

- [ ] ArgoCD muestra `comicrent-p8` en `Synced/Healthy`.
- [ ] El Rollout muestra `Healthy`, paso 10 y tres réplicas disponibles.
- [ ] La tabla 4.1 del README está completa.
- [ ] Los enlaces abren sin autenticación adicional.
- [ ] El video de Drive puede reproducirse con “cualquiera con el enlace”.
- [ ] La terminal del port-forward permanece abierta durante la demostración.
- [ ] No se muestra ninguna clave, token, kubeconfig o secreto descifrado.
