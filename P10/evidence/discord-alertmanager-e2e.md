# Evidencia: Alertmanager estable hacia Discord

**Fecha de verificación:** 14 de octubre de 2026

**Canal:** `#alertas-p10` del servidor `ComicRent P10 - Alertas`

**Alerta de prueba posterior a HA:** `P10DiscordHAValidation`, severidad `warning`

**GitOps:** `main`, commit `b2d655d87398bfd7c33b156c13d9050bb1c68564`

## Resultado

La aplicación raíz `p10-observability` y la aplicación hija `p10-prometheus` quedaron `Synced/Healthy` en la revisión GitOps `b2d655d`. ArgoCD aplicó el `SealedSecret` `p10-alertmanager-discord`; el controlador creó el Secret de ejecución con una clave `webhook_url`. El valor del webhook no se imprimió ni se guardó en texto plano.

Se configuraron dos réplicas de Alertmanager. Ambas quedaron `Ready` en nodos distintos y el API reportó `cluster=ready`, dos peers y `alertmanager_cluster_members 2`. El operador configura el gossip de los peers. La configuración activa contiene el receptor `discord-comicrent`, utiliza el archivo montado `/etc/alertmanager/secrets/p10-alertmanager-discord/webhook_url` y envía al canal las alertas `warning` y `critical`. El receptor `discard` es el destino predeterminado para alertas que no coincidan con esa ruta.

Después de activar HA se envió una alerta sintética de verificación al API del Alertmanager estable. La API respondió HTTP `200`; la alerta apareció asociada al receptor `discord-comicrent`. Tras el `group_wait`, la métrica por réplica mostró un envío exitoso en uno de los peers y ninguno en el otro, sin errores. Ambos peers reportaron la misma ruta Discord y el estado `ready`; el envío quedó confirmado desde el grupo HA:

```text
alertmanager_cluster_members 2
alertmanager_notifications_total{integration="discord"} 1
alertmanager_notifications_failed_total{integration="discord",reason="authError"} 0
alertmanager_notifications_failed_total{integration="discord",reason="clientError"} 0
alertmanager_notifications_failed_total{integration="discord",reason="contextCanceled"} 0
alertmanager_notifications_failed_total{integration="discord",reason="contextDeadlineExceeded"} 0
alertmanager_notifications_failed_total{integration="discord",reason="other"} 0
alertmanager_notifications_failed_total{integration="discord",reason="rateLimited"} 0
alertmanager_notifications_failed_total{integration="discord",reason="serverError"} 0
```

La alerta de prueba se envió directamente al API de Alertmanager; por ello verifica el enrutamiento, la entrega del receptor Discord y el estado del clúster HA. Las reglas SLO que generan alertas desde Prometheus se demuestran por separado con `PrometheusRule comicrent-slo-rules` y la evidencia de alertas disparadas. La alerta de prueba expiró automáticamente y ya no figura activa.

## Comprobación durante la calificación

Desde PowerShell, reenviar el puerto y abrir la interfaz:

```powershell
kubectl port-forward -n observability svc/p10-observability-kube-pro-alertmanager 9093:9093
```

Visitar `http://127.0.0.1:9093`. En **Status → Configuration**, comprobar la ruta de severidad y el receptor `discord-comicrent`; en **Alerts**, se puede verificar el estado de alertas. Para comprobar entrega sin mostrar secretos, consultar:

```powershell
(Invoke-WebRequest 'http://127.0.0.1:9093/metrics').Content | Select-String 'alertmanager_notifications_total\{integration="discord"\}|alertmanager_notifications_failed_total\{integration="discord"'
```

Con la configuración actual, **Status** debe mostrar `Cluster Status: ready` y dos peers. Si vuelve a indicar `disabled`, revisar que el CR de Alertmanager tenga dos réplicas y que exista conectividad entre los pods por el puerto `9094` (TCP y UDP).

## Manejo del secreto

El repositorio GitOps contiene únicamente el `SealedSecret` cifrado y la referencia al archivo. El webhook es una credencial: no debe copiarse a capturas, logs, historial de terminal ni documentación.
