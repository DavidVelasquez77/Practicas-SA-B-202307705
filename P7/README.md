# Práctica 7 — CI/CD de ComicRent

## Estado de implementación

Auditoría e implementación inicial realizadas el 8 de septiembre de 2026. Pasaron los builds de los tres servicios Node, diez unitarias (Gateway/Auth/Comics/Rentals/Copies), tres integraciones reales y Helm lint. Se construyeron cuatro imágenes de producción (Comics, Rentals, Copies y operations-jobs). La prueba del CronJob, imágenes Gateway/Auth, validación en Actions, publicación GHCR y CD están pendientes. No confundir validación local con despliegue cloud completado.

## Auditoría previa a modificaciones

- Repositorio local: `C:\Users\Vela\Desktop\SA\LAB\PRACTICAS`. Rama `main`, sin cambios pendientes al iniciar. El estado local indica seguimiento de `origin/main`; no se ha consultado todavía el estado remoto.
- El remoto configurado es `DavidVelasquez77/Pr-cticas-SA-B-202307705`. El usuario decidió conservarlo. Se verificó en GitHub que redirige al nombre canónico `DavidVelasquez77/Practicas-SA-B-202307705`: es el mismo repositorio. WIF usa el nombre canónico y los IDs numéricos del repositorio/propietario.
- Enunciado oficial revisado: `0780_Practica_7_2S2026.md`, recuperado del adjunto de la conversación de referencia.
- P4 conserva Gateway, Auth y Comics (NestJS/TypeScript), Rentals y Copies (Python/FastAPI), código y Dockerfiles de producción.
- Gateway y Comics incluyen Jest/ts-jest y plantillas de pruebas E2E. Auth no tiene script de tests. No se encontraron pruebas unitarias versionadas ni configuración pytest en los servicios Python.
- Existen lockfiles npm para los tres servicios Node. Los seis Dockerfile.prod ya son multietapa; los Python usan 3.12 y los Node 22.
- P5 conserva el chart padre `P5/helm/comicrent`, sus subcharts y `P5/jobs`. Copies Consumer reutiliza la imagen de Copies; Summary Consumer y CronJobs reutilizan operations-jobs.
- P6 conserva `P6/k8s/values-gke-prod.yaml`, la adaptación de NetworkPolicy DNS y los scripts GKE.
- Datos documentados en P6: proyecto `comicrent-p6-2026`, clúster `comicrent-gke-p6`, zona `us-central1-a`, node pool `default-pool`, namespace `sa-p6`, release Helm `comicrent`.
- La consulta autenticada a GCP confirmó el clúster RUNNING y ninguna VM del proyecto. El control plane permanece disponible aunque no haya nodos. No se ha escalado ni recreado infraestructura.
- P6 usa Secrets preexistentes para bases de datos, RabbitMQ y Auth. CD debe reutilizarlos sin imprimir su contenido.
- El script de P6 resuelve la StorageClass y la IP de kube-dns en el clúster. CD debe conservar esa adaptación y la imagen RabbitMQ actualmente desplegada.

## Cambios previstos

1. Añadir 11 pruebas unitarias: dos por microservicio y una del CronJob. Añadir tres integraciones reales: Rentals–Comics, Rentals–Copies y publicación/consumo RabbitMQ.
2. CI en PR y push a main: instalación reproducible, build y tests. CD reutiliza la validación al recibir tags `v*`, publica seis imágenes en GHCR y despliega con Helm sobre GKE mediante OIDC/WIF.
3. Reutilizar P4/P5/P6 sin duplicarlos. P7 contiene documentación, diagrama, evidencias y configuración exclusiva de CI/CD.
4. Publicar imágenes con versión release y trazabilidad al commit. El registry público es un requisito del enunciado.
5. Documentar las ejecuciones reales y un fallo controlado seguido de corrección. No presentar capturas pendientes como evidencia realizada.

## Estrategia de pruebas

Objetivo: 11 unitarias y 3 integraciones, 78.6% y 21.4% de los casos respectivamente. Estos porcentajes no miden cobertura de líneas. No se incluyen pruebas UI porque no existe interfaz gráfica en P4; la ausencia de UI no impide técnicamente hacer E2E de API, pero esa categoría queda fuera del alcance acordado.

## Evaluación

La rúbrica asigna documentación 10, diagrama 10, organización 5, preguntas teóricas 15, pipeline 20, Docker 15, deploy 15 y versionamiento 10. El enunciado no incluye una lista concreta de preguntas teóricas ni exige porcentajes de tipos de pruebas.

## Flujo implementado

![Pipeline de P7](diagrams/pipeline.svg)

El workflow `.github/workflows/p7-ci.yml` recibe PR, push a main y llamadas reutilizables desde CD. Compila los tres servicios NestJS y los módulos Python, ejecuta las unitarias y luego las tres integraciones. Otro job comprueba Helm usando las dependencias ya versionadas de P5 y los valores P6/P7.

`.github/workflows/p7-cd.yml` recibe tags `v*`, exige formato `vX.Y.Z` y que el commit pertenezca al historial de main. Reutiliza CI con `workflow_call`; si falla cualquier validación, el job de dockerización queda omitido y tampoco corre deploy. Con las validaciones verdes, construye/publica seis imágenes con permisos `packages: write` y `GITHUB_TOKEN`. Deploy solicita un token OIDC con `id-token: write`, lo intercambia mediante WIF y utiliza la Service Account dedicada.

Se serializan los despliegues para evitar dos Helm upgrades simultáneos. No se cancela un upgrade en marcha. No reutilizar un tag para otro commit: cada versión nueva requiere un tag nuevo.

Las integraciones levantan contenedores locales dentro del runner de GitHub Actions. Esto es infraestructura de pruebas; la aplicación evaluada se despliega en **GCP/GKE**. No se usan credenciales de Neon ni datos de producción en CI.

## Organización y pruebas

| Componente | Pruebas y herramienta | Cantidad |
| --- | --- | ---: |
| P4/api-gateway | Jest: routing de login/cookie y error de red convertido a 502 | 2 |
| P4/services/auth-service | Node test runner: login válido y contraseña inválida; prueba el build real | 2 |
| P4/services/comics-service | Jest: normalización de catálogo y comic inexistente | 2 |
| P4/services/rentals-service | unittest: días inválidos y ausencia de ejemplares | 2 |
| P4/services/copies-service | unittest: reservar ejemplar y ejemplar inexistente | 2 |
| P5/jobs | unittest: insert del CronJob, carnet, fecha GMT-6 y commit | 1 |
| P4/tests/integration | unittest + PostgreSQL/RabbitMQ/servicios reales en Docker | 3 |

Las unitarias sustituyen únicamente colaboradores externos y no abren conexiones. Las integraciones ejecutan el cliente GraphQL real de Rentals contra Comics, la creación de un alquiler con reserva HTTP real de Copies y la devolución publicada por Rentals que consume el proceso real de Copies. Se verifican respuestas, persistencia y cambio de estado. No son mocks disfrazados de integración.

Auth usa el runner incorporado de Node para evitar instalar un framework adicional. Gateway y Comics conservan Jest. Python usa `unittest` de su biblioteca estándar; no hace falta añadir pytest para cumplir la rúbrica. El código funcional de los microservicios y P6 permanece intacto.

## Reproducir validaciones

Desde cada servicio Node ejecutar `npm ci`. En Auth y Comics ejecutar `npx --no-install prisma generate` con `DATABASE_URL` sintética, luego `npm run build`. Gateway/Comics: `npm test -- --runInBand`; Auth: `npm test`.

Para cada servicio Python, crear un entorno Python 3.12 independiente, instalar su `requirements.txt` y ejecutar `python -m unittest discover -s tests -v` desde su carpeta. Repetir en `P5/jobs` para el CronJob. No cargar archivos `.env` de producción durante tests.

Desde la raíz del repositorio, con Docker Desktop activo:

```powershell
docker compose -p comicrent-p7-tests -f P4/tests/integration/compose.yaml build
docker compose -p comicrent-p7-tests -f P4/tests/integration/compose.yaml up --abort-on-container-exit --exit-code-from tests
# Retira exclusivamente recursos del proyecto de tests, incluidas sus bases desechables:
docker compose -p comicrent-p7-tests -f P4/tests/integration/compose.yaml down --volumes --remove-orphans
```

```powershell
helm lint P5/helm/comicrent -f P6/k8s/values-gke-prod.yaml -f P7/config/values-ci-cd.yaml
helm template comicrent P5/helm/comicrent --namespace sa-p6 -f P6/k8s/values-gke-prod.yaml -f P7/config/values-ci-cd.yaml
```

El tag `must-set-release-tag` del override es intencional: CD lo reemplaza con la versión. No desplegar directamente ese archivo sin el tag de release.

## Configuración OIDC/WIF por el propietario

La consulta inicial no encontró pools WIF; solo existía la Service Account predeterminada de Compute Engine. El 8 de septiembre el usuario autorizó expresamente completar también esta configuración. Se ejecutó `P7/config/setup-wif.ps1` con su sesión gcloud existente y se crearon correctamente pool, provider, Service Account y RBAC. El script permite reproducir la configuración por un operador autorizado. Se detiene si el nombre canónico no coincide. No genera ni descarga llaves JSON y no escala GKE.

El script configura:

- Pool `github-p7` y provider `github` en el proyecto existente.
- Service Account `github-p7-deployer@comicrent-p6-2026.iam.gserviceaccount.com`.
- Condición que restringe la confianza a IDs numéricos de repositorio y propietario, eventos push de tags `v*` y el workflow CD de este repositorio.
- `roles/iam.workloadIdentityUser` exclusivamente para ese principal del pool.
- `roles/container.clusterViewer` para obtener acceso al endpoint del clúster.
- RBAC de administración limitado a `sa-p6`, lectura de nodos/namespaces y lectura exclusiva del Service `kube-dns` en kube-system. Helm necesita manejar Secrets de historial y Roles/RoleBindings del chart; por ello su permiso dentro de sa-p6 es amplio. No obtiene administración global del clúster ni capacidad de escalar infraestructura GCP.

Después crear **Variables**, no Secrets, en [Settings → Actions → Variables](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/settings/variables/actions):

| Variable | Valor |
| --- | --- |
| GCP_WIF_PROVIDER | projects/950813313175/locations/global/workloadIdentityPools/github-p7/providers/github |
| GCP_SERVICE_ACCOUNT | github-p7-deployer@comicrent-p6-2026.iam.gserviceaccount.com |

Estos identificadores no son credenciales. No enviar tokens ni llaves al chat, capturas o repositorio. Esperar la propagación de WIF antes de probar CD. La configuración aún debe confirmarse mediante una ejecución real de GitHub Actions.

## GHCR y versiones

Se publican `ghcr.io/davidvelasquez77/comicrent-{api-gateway,auth-service,comics-service,rentals-service,copies-service,operations-jobs}` con tags de release y `sha-COMMIT_COMPLETO`. Las etiquetas OCI registran repositorio, commit y versión. Copies Consumer reutiliza copies-service; Summary Consumer y ambos CronJobs reutilizan operations-jobs.

GHCR puede crear los paquetes privados en la primera publicación. El propietario debe cambiar cada uno a **Public** en Package settings → Change visibility. CD comprueba lectura anónima antes de tocar GKE; si falla por visibilidad, hacer públicos los paquetes y reejecutar solamente los jobs fallidos. Esto satisface el requisito de registry público y evita un imagePullSecret con PAT.

## Despliegue GKE

Antes del tag de evaluación, el propietario sube **el pool existente**:

```powershell
gcloud container clusters resize comicrent-gke-p6 --node-pool=default-pool --num-nodes=1 --zone=us-central1-a --project=comicrent-p6-2026
```

El script CD `P7/config/deploy.sh` verifica release Helm existente y nodo Ready, conserva imagen y StorageClass del RabbitMQ desplegado, comprueba la existencia de Secrets sin mostrar contenido y aplica la adaptación DNS/entrada pública de P6. Ejecuta Helm upgrade con los valores P6/P7, tag común y SHA, `--atomic --wait --timeout 15m`. Un fallo durante el upgrade activa rollback de Helm. La verificación posterior exige rollouts de siete deployments, RabbitMQ y respuesta pública `/health`; si falla health después de finalizar Helm, el job falla pero esa comprobación posterior no dispara automáticamente rollback.

No se instala un clúster nuevo, no se escala desde el workflow y no se recrean credenciales de bases de datos. Al terminar la evaluación, el propietario puede seguir el procedimiento de pausa de P6 para volver a 0 nodos.

## Evidencia y fallo controlado

Estado actual: validaciones locales reales; evidencias de Actions/GHCR/GKE pendientes. CI guarda logs de unitarias e integración como artifacts incluso al fallar. No adjunta manifests con datos sensibles ni logs de producción.

El fallo controlado debe hacerse en una rama de demostración con una aserción incorrecta en un test existente, abrir PR, capturar el test rojo, corregir la aserción y capturar el mismo PR verde antes de integrar. Para demostrar específicamente el bloqueo de dockerización/deploy se debe registrar también un CD cuyo job de tests falle; no publicar un tag de producción roto en main. La realización exacta y las URLs se documentarán al ejecutar la demostración; hasta entonces no se afirma que exista evidencia.

| Evidencia | Estado |
| --- | --- |
| Unitarias/build local y tres integraciones | Ejecuciones obtenidas; captura visual pendiente |
| CI verde de PR/main | Pendiente |
| Fallo controlado y corrección | Pendiente |
| Seis paquetes GHCR públicos/versionados | Pendiente |
| WIF/Service Account sin credenciales visibles | Pendiente de configuración por el propietario |
| CD verde, Helm/version, pods y gateway GKE | Pendiente |

## Preguntas teóricas de preparación

**¿Qué diferencia existe entre CI y CD en esta práctica?** CI detecta cambios que no compilan o rompen contratos antes de publicar una versión. CD toma un release que pasó esos mismos controles, genera imágenes identificables y actualiza GKE. Separar triggers evita desplegar cada PR.

**¿Por qué detener Docker/deploy si fallan los tests?** Un build correcto no garantiza comportamiento correcto. `needs: tests` convierte las pruebas en una dependencia obligatoria; no se configura `continue-on-error` para superar un fallo funcional.

**¿Por qué versionar imágenes?** Un tag de release identifica la entrega y el SHA la relaciona con el código. Solo `latest` impide distinguir qué versión corre o reproducir un rollback. Los tags no deben moverse a commits diferentes.

**¿Qué aporta un Dockerfile multietapa?** Compila/instala en una etapa y copia lo necesario a la imagen final con usuario sin privilegios. Los Node Auth/Comics conservan además Prisma CLI para las tareas de migración heredadas; no se promete una imagen mínima absoluta.

**¿Por qué WIF en vez de una llave JSON?** GitHub presenta una identidad OIDC de corta duración que GCP valida según el repositorio, workflow y referencia. Se evita guardar una llave de Service Account permanente; sigue siendo imprescindible limitar la confianza y los permisos.

**¿Qué aportan las integraciones?** Detectan incompatibilidades de contratos HTTP/GraphQL y de mensajería/persistencia que las unitarias con colaboradores simulados no pueden descubrir. El caso RabbitMQ verifica el efecto final, no solamente que se llamó un método publish.

**¿Cómo se mantiene reproducibilidad sin duplicación?** Los workflows construyen directamente el código de P4 y jobs de P5, usan el chart de P5 con configuración GKE de P6 y añaden solo overrides P7. Una corrección al servicio o chart se mantiene en su fuente original.

**¿Qué límites tiene el rollback?** Helm puede revertir recursos e imágenes ante un upgrade fallido. No revierte automáticamente cambios destructivos de datos o migraciones; por eso los cambios de esquema deben ser compatibles y planificados. Esta P7 no añade migraciones nuevas.

## Referencias oficiales

- [GitHub Actions: workflows reutilizables](https://docs.github.com/en/actions/how-tos/sharing-automations/reusing-workflows)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Autenticación Google GitHub Actions mediante WIF](https://github.com/google-github-actions/auth)
- [Credenciales GKE para Actions](https://github.com/google-github-actions/get-gke-credentials)
- [WIF para pipelines de despliegue](https://cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

## Hito: fallo controlado ejecutado y corregido

El commit `e84b640` cambió solo una expectativa del test de Auth de 1 a 99. El código de aplicación permaneció intacto. [CI #1](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34271159061) falló exactamente por `1 !== 99`; las otras unitarias y Helm pasaron. [CD v0.7.1](https://github.com/DavidVelasquez77/Practicas-SA-B-202307705/actions/runs/34273962993) volvió a detectar el fallo y omitió Docker y deploy. `v0.7.0` se publicó al registrar inicialmente los workflows y no produjo ejecución CD; se conserva como referencia sin despliegue. Ambos tags de demostración no son versiones para desplegar.

La expectativa correcta se restauró antes de preparar `v0.7.2`. No se movieron tags ni se reescribió historial. El CronJob pasó su prueba unitaria en Actions. WIF y las dos variables GitHub están configurados, y el usuario autorizó levantar 1 nodo: `default-pool` está Ready.

![CI rojo controlado](evidence/02-ci-failure-controlled.png)
![Aserción de Auth](evidence/03-auth-controlled-assertion.png)
![CD bloqueado por tests](evidence/04-cd-blocked-by-tests.png)
![Variables no secretas](evidence/01-actions-variables.png)
