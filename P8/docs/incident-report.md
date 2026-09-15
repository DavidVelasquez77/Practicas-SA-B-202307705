# Informe de incidente — fallo inducido de Canary

**Qué falló:** Se publicó temporalmente una revisión defectuosa del `api-gateway`. Para inducir el fallo, el smoke test consultó `/definitely-not-health` en lugar de `/health`. La revisión nueva llegó al primer paso Canary, pero no pudo superar la validación.

**Cómo se detectó:** Argo Rollouts ejecutó el `AnalysisTemplate` `api-gateway-smoke`, que crea un Job k6 contra el Service Canary. El métrico `k6-smoke-health` terminó `Failed`: `http_req_failed` fue mayor que `rate==0` y superó `failureLimit: 0`. El `AnalysisRun` `comicrent-api-gateway-rollout-6cf578987c-3-1` inició a las `2026-09-15T00:27:57Z` y terminó `Failed` a las `00:30:06Z`.

**Cómo se contuvo:** Argo Rollouts abortó automáticamente la revisión nueva durante la promoción Canary y mantuvo el ReplicaSet estable atendiendo el tráfico. La versión defectuosa no avanzó al 25%, 50% ni 100%. La versión sana se restauró mediante la PR [GitOps #13](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/13), sincronizada por ArgoCD.

**Tiempo de recuperación:** El análisis tardó 129 segundos desde el inicio hasta el aborto. Después de fusionar la restauración, el Rollout volvió a `Healthy` en el paso 10, sin intervención manual sobre los recursos de la aplicación.

**Cómo prevenirlo:** Mantener el análisis k6 como condición obligatoria de cada promoción, conservar `failureLimit: 0`, ejecutar pruebas de integración antes de publicar la imagen y exigir Trivy, SBOM, firma Cosign y verificación Kyverno antes de que la imagen pueda llegar al clúster. Así, una imagen con vulnerabilidades críticas, sin firma o con comportamiento incorrecto queda detenida antes de recibir tráfico completo.

![Flujo del rollback automático](../diagrams/p8-canary-rollback.png)
