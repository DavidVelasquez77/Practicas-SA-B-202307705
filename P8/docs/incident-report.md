# Informe de incidente controlado — P8

- **Qué falló:** el smoke test Canary llamó temporalmente a `/definitely-not-health`; el endpoint no devolvió el estado esperado.
- **Cómo se detectó:** `AnalysisTemplate/api-gateway-smoke` ejecutó k6 y el métrico `http_req_failed` superó `rate==0`; el `AnalysisRun` terminó `Failed`.
- **Cómo se contuvo:** Argo Rollouts abortó la revisión 3 a las `2026-09-15T00:30:06Z`, detuvo la promoción antes del 25% y conservó el ReplicaSet estable `7fb647ddcc`.
- **Tiempo de recuperación:** el análisis inició `2026-09-15T00:27:57Z` y finalizó `2026-09-15T00:30:06Z` (129 segundos). La configuración sana quedó restaurada por la [PR #13](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705-gitops/pull/13) y el Rollout volvió a `Healthy`, paso 10.
- **Prevención:** cada promoción ejecuta k6 con umbrales de error y latencia; Trivy bloquea CVE `CRITICAL`, se genera SBOM, Cosign firma y verifica las imágenes, y Kyverno rechaza imágenes sin firma, `latest`, sin recursos o ejecutadas como root.

Evidencia detallada: [`../evidence/canary-rollback.txt`](../evidence/canary-rollback.txt).
