# Informe de incidente controlado — P8

- **Qué falló:** versión Canary de `api-gateway` con health check no satisfactorio.
- **Cómo se detectó:** `AnalysisTemplate/api-gateway-smoke` ejecutó k6 y superó el umbral de error permitido (0%).
- **Cómo se contuvo:** la promoción se detuvo antes del 25%; el tráfico permaneció en la versión estable.
- **Tiempo de recuperación:** se medirá con los timestamps del historial de Argo Rollouts durante la demostración.
- **Prevención:** pruebas k6 por etapa, Trivy, SBOM, Cosign y políticas Kyverno antes de permitir una nueva versión.
