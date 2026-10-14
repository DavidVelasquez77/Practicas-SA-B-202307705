# Evidencia: Alertmanager estable hacia Discord

**Fecha de verificación:** 14 de octubre de 2026, aproximadamente 22:50 UTC

**Canal:** `#alertas-p10` del servidor `ComicRent P10 - Alertas`

**Alerta de prueba:** `P10DiscordLiveVerification`, severidad `warning`

**GitOps:** `main`, commit `919c4538592652a3ca08c8b6ab7dede514c01f22`

## Resultado

La aplicación raíz `p10-observability` y la aplicación hija `p10-prometheus` quedaron `Synced/Healthy` en la revisión GitOps `919c453`. ArgoCD aplicó el `SealedSecret` `p10-alertmanager-discord`; el controlador creó el Secret de ejecución con una clave `webhook_url`. El valor del webhook no se imprimió ni se guardó en texto plano.

El Alertmanager estable quedó disponible con sus dos contenedores `Ready`, sin reinicios. Su configuración activa contiene el receptor `discord-comicrent`, utiliza el archivo montado `/etc/alertmanager/secrets/p10-alertmanager-discord/webhook_url` y envía al canal las alertas `warning` y `critical`. El receptor `discard` es el destino predeterminado para alertas que no coincidan con esa ruta.

Se envió una alerta sintética de verificación al API del Alertmanager estable. La API respondió HTTP `200`; la alerta apareció asociada al receptor `discord-comicrent`. Después del `group_wait` de 30 segundos, las métricas del Alertmanager mostraron:

```text
alertmanager_notifications_total{integration="discord"} 1
alertmanager_notifications_failed_total{integration="discord",reason="authError"} 0
alertmanager_notifications_failed_total{integration="discord",reason="clientError"} 0
alertmanager_notifications_failed_total{integration="discord",reason="contextCanceled"} 0
alertmanager_notifications_failed_total{integration="discord",reason="contextDeadlineExceeded"} 0
alertmanager_notifications_failed_total{integration="discord",reason="other"} 0
alertmanager_notifications_failed_total{integration="discord",reason="rateLimited"} 0
alertmanager_notifications_failed_total{integration="discord",reason="serverError"} 0
```

La alerta de prueba se envió directamente al API de Alertmanager; por ello verifica el enrutamiento y la entrega del receptor Discord. Las reglas SLO que generan alertas desde Prometheus se demuestran por separado con `PrometheusRule comicrent-slo-rules` y la evidencia de alertas disparadas.

## Comprobación durante la calificación

Desde PowerShell, reenviar el puerto y abrir la interfaz:

```powershell
kubectl port-forward -n observability svc/p10-observability-kube-pro-alertmanager 9093:9093
```

Visitar `http://127.0.0.1:9093`. En **Status → Configuration**, comprobar la ruta de severidad y el receptor `discord-comicrent`; en **Alerts**, se puede verificar el estado de alertas. Para comprobar entrega sin mostrar secretos, consultar:

```powershell
(Invoke-WebRequest 'http://127.0.0.1:9093/metrics').Content | Select-String 'alertmanager_notifications_total\{integration="discord"\}|alertmanager_notifications_failed_total\{integration="discord"'
```

La página **Status** puede seguir mostrando `Cluster Status: disabled`. Eso describe que solo hay una réplica de Alertmanager y no un clúster HA con peers; no deshabilita las rutas ni el envío a Discord.

## Manejo del secreto

El repositorio GitOps contiene únicamente el `SealedSecret` cifrado y la referencia al archivo. El webhook es una credencial: no debe copiarse a capturas, logs, historial de terminal ni documentación.
