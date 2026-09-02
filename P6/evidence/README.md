# Evidencias de P6

Esta carpeta debe contener las capturas finales del despliegue real:

- Consola de GKE mostrando el cluster administrado y el nodo.
- Artifact Registry mostrando las imágenes privadas.
- `kubectl get pods -o wide` con la plataforma saludable.
- Service `comicrent-api-gateway` con su IP `EXTERNAL-IP`.
- Petición desde internet a `/health`, Swagger y una operación funcional.
- Flujo asíncrono de devoluciones y resumen horario en RabbitMQ.
- PVC enlazado a la StorageClass reportada por GKE.

En la ejecución actual, el Gateway obtuvo `136.119.74.33` y RabbitMQ quedó enlazado a `standard-rwo`. Las respuestas públicas de `/health`, `/docs` y `/docs-json` fueron HTTP 200. No incluir capturas ni archivos que revelen Secrets, URLs de conexión, contraseñas o tokens.

El script `scripts/06-collect-evidence.ps1` genera archivos de texto de apoyo sin incluir valores de Secrets.

Además, `functional-check.txt` y `async-check.txt` registran las comprobaciones funcionales y asíncronas realizadas sobre el despliegue real.
