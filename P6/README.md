# Práctica 6 - ComicRent en GKE

Esta carpeta contiene únicamente la configuración cloud, los scripts y las evidencias de P6. El chart completo se reutiliza directamente desde `P5/helm/comicrent`; no se duplica dentro de P6.

## Decisiones de arquitectura

- Proveedor: Google Cloud Platform, usando un clúster GKE Standard zonal.
- Tamaño del clúster: 1 nodo, siguiendo la aclaración del auxiliar para proteger los créditos. El PDF oficial menciona al menos 2 nodos; esta diferencia debe quedar explícita en la entrega.
- Registro: Google Artifact Registry privado. Las imágenes propias y la imagen de RabbitMQ se publican en el registry privado.
- Bases de datos: PostgreSQL no se despliega en GKE. Se usan tres proyectos Neon:
  - Proyecto Neon 1: `auth_db`.
  - Proyecto Neon 2: `comics_db` y `copies_db`.
  - Proyecto Neon 3: `rentals_db` y `operations_db`.
- Mensajería: RabbitMQ permanece dentro de GKE y conserva un PVC.
- Entrada pública: solamente `comicrent-api-gateway` usa `Service: LoadBalancer`. Los demás servicios y RabbitMQ son `ClusterIP`.
- Seguridad: `default-deny`, allowlists existentes de P5, RBAC, probes, HPA, PDB, ResourceQuota y LimitRange se mantienen.

## Archivos de P6

```text
P6/
├── k8s/values-gke-prod.yaml
├── k8s/values-gke-secret.example.yaml
├── scripts/
│   ├── _common.ps1
│   ├── 00-validate-local.ps1
│   ├── 00-authenticate-gcloud.ps1
│   ├── 01-build-and-push-images.ps1
│   ├── 02-create-gke-cluster.ps1
│   ├── 03-generate-secrets.ps1
│   ├── 04-deploy-gke-prod.ps1
│   ├── 05-destroy-gke-resources.ps1
│   └── 06-collect-evidence.ps1
├── evidence/
└── README.md
```

`values-gke-secret.yaml` está excluido por `.gitignore`. Los valores reales se capturan directamente en la terminal y terminan únicamente en Secrets de Kubernetes.

## Despliegue realizado

La prueba real de P6 se ejecutó con estos datos:

- Proyecto GCP: `comicrent-p6-2026`.
- Clúster: `comicrent-gke-p6`, GKE Standard zonal en `us-central1-a`.
- Node pool: 1 nodo `e2-standard-2`, según la aclaración del auxiliar.
- Artifact Registry privado: `us-central1-docker.pkg.dev/comicrent-p6-2026/comicrent`.
- StorageClass de GKE utilizada por RabbitMQ: `standard-rwo` (`pd.csi.gke.io`).
- Gateway público probado: `http://136.119.74.33:3000`.
- Endpoints públicos comprobados: `/health`, `/docs` y `/docs-json`, todos con HTTP 200.

Los proyectos Neon utilizados fueron `silent-frost-23687495` (auth), `silent-mode-47278928` (catálogo) y `twilight-cherry-83337673` (operaciones). Sus URLs y credenciales no se incluyen en esta documentación.

El despliegue se recreó posteriormente con la misma configuración y quedó encendido con 1 nodo para continuar la demostración. No se volverá a eliminar ni escalar sin una indicación explícita.

## Requisitos previos

Instalar y tener disponibles `Docker`, `Helm`, `kubectl`, `gcloud` y una cuenta GCP con créditos o facturación habilitada. No pegar contraseñas, tokens ni URLs de Neon en el repositorio ni en el chat.

## Flujo reproducible

Ejecutar desde `C:\Users\Vela\Desktop\SA\LAB\PRACTICAS`.

### 1. Validar antes de crear recursos cloud

```powershell
.\P6\scripts\00-validate-local.ps1
```

Este paso construye los seis `Dockerfile.prod`, valida el chart y renderiza la configuración cloud temporalmente. No crea recursos GCP.

### 2. Autenticar GCP

```powershell
.\P6\scripts\00-authenticate-gcloud.ps1 -ProjectId "ID_DEL_PROYECTO"
```

El navegador se abrirá para la autenticación interactiva. El script habilita GKE y Artifact Registry y configura Docker para el host regional del registry.

### 3. Crear Artifact Registry y publicar imágenes

```powershell
.\P6\scripts\01-build-and-push-images.ps1 `
  -ProjectId "ID_DEL_PROYECTO" `
  -Region "us-central1" `
  -Tag "1.0.0-gke"
```

El script crea el repositorio `comicrent` si no existe, publica las seis imágenes de la aplicación y copia RabbitMQ al mismo registry privado.

### 4. Crear el clúster de un nodo

```powershell
.\P6\scripts\02-create-gke-cluster.ps1 `
  -ProjectId "ID_DEL_PROYECTO" `
  -Zone "us-central1-a" `
  -ClusterName "comicrent-gke-p6" `
  -NodeCount 1
```

El tipo de máquina predeterminado es `e2-standard-2`, con disco persistente balanceado de 20 GiB. La opción de NetworkPolicy se habilita al crear GKE.

### 5. Crear proyectos y bases Neon

En Neon crear los tres proyectos acordados y sus bases lógicas. Aplicar los esquemas/migraciones de P4 a cada base antes del despliegue. Las URLs deben usar SSL, normalmente con `sslmode=require`.

Luego ejecutar:

```powershell
.\P6\scripts\03-generate-secrets.ps1
```

El script solicita de forma oculta las cinco URLs de Neon, el password de RabbitMQ, el JWT secret y la encryption key. Convierte automáticamente las URLs de rentals y copies al dialecto `postgresql+psycopg` que usan SQLAlchemy. No imprime ni guarda los valores.

### 6. Desplegar con Helm reutilizando P5

```powershell
.\P6\scripts\04-deploy-gke-prod.ps1 `
  -ProjectId "ID_DEL_PROYECTO" `
  -Zone "us-central1-a" `
  -ClusterName "comicrent-gke-p6" `
  -Tag "1.0.0-gke"
```

El script obtiene la `StorageClass` real que reporta GKE y la pasa al PVC de RabbitMQ. No se fija un nombre inventado en el repositorio. También valida Helm, instala/actualiza el chart padre de P5 y espera los Deployments.

Comprobar la IP pública:

```powershell
kubectl get svc comicrent-api-gateway -n sa-p6 -w
```

Cuando aparezca `EXTERNAL-IP`, probar desde una red externa:

```powershell
Invoke-WebRequest http://IP_PUBLICA/health
```

Documentar también Swagger y una prueba funcional síncrona. Para el flujo asíncrono, demostrar `copy.return.requested`, el procesamiento del Copies Consumer con commit antes de ACK y el resumen `operations.hourly.summary` almacenado en `operations_db`.

### 7. Capturar evidencias

```powershell
.\P6\scripts\06-collect-evidence.ps1 -Namespace "sa-p6" -PublicBaseUrl "http://IP_PUBLICA:3000"
```

Agregar capturas de GKE, Artifact Registry, Pods, PVC/StorageClass, Service LoadBalancer y peticiones hechas desde internet. Nunca capturar el contenido de los Secrets.

## Preguntas teóricas

1. **¿Qué es un clúster administrado y qué cambia frente a uno local?** Un clúster administrado es Kubernetes operado parcialmente por el proveedor cloud. El proveedor mantiene el plano de control, sus actualizaciones y parte de la integración de red; el estudiante sigue administrando namespaces, workloads, imágenes, configuración, políticas y costos. En local normalmente se simulan el balanceo y el almacenamiento, mientras que en GKE se consumen recursos reales.

2. **¿Qué es un Service `LoadBalancer`?** Es un Service que solicita al proveedor un balanceador externo y una dirección pública. GKE crea y conecta ese balanceador con los Pods seleccionados por el Service. En ComicRent solo el Gateway tiene ese tipo; los servicios internos continúan como `ClusterIP`.

3. **¿Qué es un registro de contenedores y por qué se necesita?** Es un repositorio que almacena y distribuye imágenes versionadas. El nodo de GKE no puede depender de imágenes que solo existen en la laptop; necesita descargar las imágenes desde Artifact Registry. Al usar un repositorio privado, el acceso queda controlado por IAM y no se publican imágenes de la aplicación.

4. **¿Qué administra el proveedor y qué administra el estudiante?** GKE administra el plano de control, la disponibilidad de sus componentes administrados y la integración con balanceadores y discos. El estudiante define el tamaño del node pool, despliega Helm, configura Secrets, NetworkPolicies, RBAC, recursos, imágenes, pruebas, permisos IAM y limpieza.

5. **¿Qué costos genera el despliegue y cómo se reducen?** El costo potencial viene principalmente del nodo Compute Engine, disco persistente, balanceador/IP pública, almacenamiento de Artifact Registry y los planes de Neon. Se reduce usando un solo nodo como aclaró el auxiliar, tamaños mínimos, una sola réplica, PVC pequeño, región única, créditos educativos y eliminación inmediata del clúster, balanceador, disco, registry y proyectos Neon cuando termina la práctica. El monto real debe respaldarse con Billing de GCP y el panel de Neon del periodo utilizado.

## Costos y limpieza

Antes de eliminar, guardar una captura de Billing y anotar: proyecto, región, fechas, tipo de nodo, horas del clúster, disco, LoadBalancer/IP, Artifact Registry y Neon. No presentar una cifra inventada: reportar el total observado y, si corresponde, separar créditos de costo de lista.

Para limpiar GKE:

```powershell
.\P6\scripts\05-destroy-gke-resources.ps1 `
  -ProjectId "ID_DEL_PROYECTO" `
  -Region "us-central1" `
  -Zone "us-central1-a" `
  -ClusterName "comicrent-gke-p6" `
  -DeleteArtifactRegistry `
  -ConfirmDestroy
```

El script desinstala Helm, elimina el namespace, elimina el clúster y opcionalmente elimina Artifact Registry. Los tres proyectos Neon deben revisarse y eliminarse manualmente desde Neon; no se borran automáticamente para evitar una eliminación accidental. Después verificar en GCP que no queden clústeres, discos, forwarding rules, IPs reservadas ni repositorios cobrables.

### Limpieza ejecutada

Al finalizar las pruebas del 2 de septiembre de 2026 se ejecutó la limpieza con `-ConfirmDestroy -DeleteArtifactRegistry`. Se eliminaron el release Helm, el namespace `sa-p6`, el clúster `comicrent-gke-p6`, su balanceador, discos asociados y el repositorio `comicrent`. La verificación posterior no reportó clústeres, repositorios, instancias, discos, IPs reservadas ni forwarding rules en el proyecto GCP. Los proyectos Neon se conservaron para no borrar datos fuera de GCP.
