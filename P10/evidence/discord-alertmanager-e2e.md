# Evidencia: Alertmanager hacia Discord

**Fecha:** 14 de octubre de 2026, 20:03 UTC  
**Canal:** `#alertas-p10` del servidor `ComicRent P10 - Alertas`  
**Alerta:** `P10DiscordDeliveryE2E`, severidad `warning`

## Resultado observado

La configuración candidata de la rama GitOps `feature/p10-observability` se renderizó con `kube-prometheus-stack` `92.3.0` y se ejecutó en una instancia temporal aislada de Alertmanager `0.34.1`. El `SealedSecret` `p10-alertmanager-discord` se descifró en el clúster y creó el Secret esperado con la clave `webhook_url`; no se imprimió ni guardó la URL en texto plano.

Se envió una alerta sintética al API de Alertmanager. El API la aceptó con HTTP `200`, la ruta de severidad `warning` la entregó a Discord después del `group_wait` de 30 segundos y el mensaje apareció en `#alertas-p10` con título, resumen, descripción y enlace al runbook.

Las métricas del Alertmanager temporal confirmaron:

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

La prueba directa previa del webhook recibió HTTP `204`. Esa respuesta confirma la aceptación de Discord; la prueba con la alerta sintética confirma además el enrutamiento de Alertmanager.

## Alcance y estado de despliegue

La prueba E2E usó la configuración y el Secret candidatos en un pod temporal. El Alertmanager estable no se modificó. Al terminar se eliminaron el pod, el ConfigMap temporal, el `SealedSecret` de prueba y el Secret descifrado.

La aplicación `p10-observability` del clúster todavía rastrea `main` en la revisión `0ea04e9`; por tanto, esta prueba valida la implementación candidata, pero la ruta no queda activa en el Alertmanager estable hasta integrar `feature/p10-observability` y esperar la sincronización de ArgoCD. Después de la sincronización se debe confirmar el receptor en el Alertmanager estable y disparar una alerta SLO `warning` o `critical` controlada para validar el canal ya desplegado.

La URL del webhook es una credencial. Se mantiene cifrada en el `SealedSecret` del repositorio GitOps y no debe aparecer en capturas, logs, ejemplos ni en este informe.
