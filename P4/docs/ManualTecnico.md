# Manual Técnico — ComicRent

**Práctica 4 — Diseño y toma de decisiones**  
**Curso:** Software Avanzado  
**Sección:** B  
**Carné:** 202307705  

---

## 1. Introducción

ComicRent es un sistema distribuido para la administración de alquileres de cómics físicos. La solución fue implementada mediante una arquitectura de microservicios, un API Gateway como punto principal de entrada, bases de datos independientes por servicio y contenerización mediante Docker Compose.

El sistema está formado por cuatro microservicios funcionales:

- **Auth Service:** autenticación, autorización, usuarios y roles.
- **Comics Service:** catálogo y precio de alquiler de los cómics.
- **Rentals Service:** creación, consulta y devolución de alquileres.
- **Copies Service:** administración de ejemplares físicos y su disponibilidad.

El API Gateway centraliza el acceso externo, valida la sesión del usuario mediante Auth Service y adapta las operaciones internas REST y GraphQL a una API pública REST documentada con OpenAPI/Swagger.

---

## 2. Objetivo del manual

Este documento describe la estructura técnica de ComicRent, los componentes desplegados, la configuración requerida, las bases de datos, los contratos de comunicación, la seguridad, el proceso de ejecución con Docker Compose y los diagramas técnicos asociados.

La finalidad es que un desarrollador pueda comprender la solución, levantarla localmente y ubicar las principales responsabilidades de cada componente.

---

## 3. Arquitectura general

ComicRent utiliza un **API Gateway** como punto principal de entrada. Las solicitudes del cliente son recibidas por el Gateway y dirigidas hacia el microservicio responsable.

El Gateway se comunica con:

- Auth Service para registro, inicio de sesión y validación de sesión.
- Comics Service para operaciones del catálogo.
- Rentals Service para alquileres y devoluciones.
- Copies Service para consulta y administración de ejemplares.

Adicionalmente, Rentals Service se comunica directamente con Comics Service y Copies Service durante el flujo de alquiler.

![Arquitectura General](./diagramas/Arquitectura%20General.png)

### 3.1 Flujo principal

```text
Cliente
   |
   v
API Gateway
   |
   +----> Auth Service
   |
   +----> Comics Service
   |
   +----> Rentals Service
   |
   +----> Copies Service
```

Durante la creación de un alquiler ocurre además:

```text
Rentals Service
   |
   +----> Comics Service
   |      valida el cómic y obtiene el precio
   |
   +----> Copies Service
          obtiene un ejemplar disponible
          y lo marca como ALQUILADO
```

Durante una devolución, Rentals Service actualiza el alquiler y solicita a Copies Service que el ejemplar vuelva al estado `DISPONIBLE`.

---

## 4. Tecnologías utilizadas

| Componente | Tecnología principal | Interfaz | Persistencia |
|---|---|---|---|
| API Gateway | NestJS + TypeScript | REST / OpenAPI | No posee BD |
| Auth Service | NestJS + TypeScript | REST | PostgreSQL |
| Comics Service | NestJS + TypeScript | GraphQL | PostgreSQL |
| Rentals Service | Python + FastAPI + Strawberry | GraphQL | PostgreSQL |
| Copies Service | Python + FastAPI | REST | PostgreSQL |

Tecnologías complementarias:

- Docker y Docker Compose.
- Node.js 22 en las imágenes de los servicios NestJS.
- Python 3.12 en las imágenes de los servicios FastAPI.
- PostgreSQL 17 Alpine para las cuatro bases de datos.
- Prisma ORM para Auth Service y Comics Service.
- SQLAlchemy asíncrono para Rentals Service y Copies Service.
- Apollo GraphQL en Comics Service.
- Strawberry GraphQL en Rentals Service.
- HTTPX para comunicación saliente desde Rentals Service.
- Swagger/OpenAPI en el API Gateway.
- JWT almacenado en cookie HTTP-only para la autenticación.
- AES-256-CBC para cifrado de información sensible en Auth Service.

---

## 5. Estructura del proyecto

La estructura principal de `P4` es:

```text
P4/
|
|-- api-gateway/
|
|-- services/
|   |-- auth-service/
|   |-- comics-service/
|   |-- rentals-service/
|   `-- copies-service/
|
|-- docs/
|   |-- diagramas/
|   |   |-- Arquitectura General.png
|   |   |-- DiagramaDespliegue.png
|   |   |-- ER-MicroservicioAuthService.png
|   |   |-- ER-MicroservicioComicService.png
|   |   |-- ER-MicroservicioCopiesService.png
|   |   `-- ER-MicroservicioRentalsService.png
|   |
|   `-- swagger/
|       `-- Contrato.json
|
|-- .env.example
|-- .gitignore
|-- docker-compose.yml
`-- README.md
```

Cada microservicio incluye su propio `Dockerfile`, dependencias y código fuente, permitiendo su construcción de manera independiente.

---

## 6. API Gateway

### 6.1 Responsabilidad

El API Gateway se encuentra en `P4/api-gateway` y es el punto de entrada oficial del sistema.

Sus responsabilidades son:

- Exponer la API pública.
- Validar los cuerpos de las solicitudes.
- Reenviar registro y login hacia Auth Service.
- Validar la cookie del usuario antes de permitir operaciones protegidas.
- Aplicar autorización por roles.
- Consumir los servicios GraphQL de Comics y Rentals.
- Consumir el servicio REST de Copies.
- Traducir la interfaz interna de los microservicios a una API REST uniforme.
- Publicar la especificación OpenAPI mediante Swagger.

### 6.2 Puerto

```text
Host:      3000
Container: 3000
```

URL principal:

```text
http://localhost:3000
```

Swagger UI:

```text
http://localhost:3000/docs
```

Documento OpenAPI generado:

```text
http://localhost:3000/docs-json
```

Una copia del contrato se conserva en:

```text
docs/swagger/Contrato.json
```

### 6.3 Validación de autenticación

Los controladores protegidos utilizan `GatewayAuthGuard`.

El flujo es:

```text
Cliente
   |
   | Cookie access_token
   v
API Gateway
   |
   | GET /auth/validate
   v
Auth Service
   |
   | usuario autenticado
   v
API Gateway
```

El Gateway no necesita acceder directamente a `auth_db` para validar una sesión.

### 6.4 Autorización por rol

Los roles soportados son:

- `Admin`
- `Cliente`

`GatewayRoleGuard` aplica las restricciones definidas mediante el decorador `@Roles`.

Las operaciones de creación de cómics y ejemplares están restringidas a `Admin`. Las operaciones de consulta y alquiler están disponibles para usuarios autenticados de acuerdo con las reglas definidas en el Gateway.

---

## 7. Auth Service

### 7.1 Responsabilidad

Auth Service administra:

- Registro de usuarios.
- Inicio de sesión.
- Roles `Admin` y `Cliente`.
- Validación del JWT.
- Renovación controlada de sesión.
- Cifrado y descifrado de información sensible.

### 7.2 Puerto

```text
Host:      3001
Container: 3001
```

### 7.3 Endpoints internos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/register` | Registra un usuario |
| POST | `/auth/login` | Valida credenciales e inicia sesión |
| GET | `/auth/validate` | Valida la cookie JWT actual |

La ruta `/auth/validate` se utiliza principalmente desde el API Gateway.

### 7.4 Seguridad de datos

Antes de almacenarse en PostgreSQL se cifran:

- nombre,
- correo,
- contraseña.

El algoritmo utilizado es:

```text
AES-256-CBC
```

La llave se recibe mediante `ENCRYPTION_KEY` y debe representar exactamente 32 bytes en formato hexadecimal, es decir, 64 caracteres hexadecimales.

Cada cifrado utiliza un IV aleatorio de 16 bytes y el valor se almacena con el formato:

```text
iv:ciphertext
```

### 7.5 JWT y cookie

Al iniciar sesión se genera un JWT con:

- `sub`: identificador del usuario.
- `role`: rol del usuario.
- `refreshUntil`: límite absoluto de renovación.
- `iat` y `exp`: administrados por el módulo JWT.

El token se almacena en:

```text
access_token
```

con configuración local:

```text
HttpOnly = true
SameSite = lax
Secure   = false
Path     = /
```

La configuración predeterminada del proyecto utiliza:

```text
JWT_EXPIRES_IN=60
JWT_REFRESH_TIME_SECONDS=60
```

Por lo tanto, el JWT inicial es válido durante 60 segundos y puede renovarse dentro de la ventana adicional configurada, sin superar el límite absoluto `refreshUntil`.

---

## 8. Comics Service

### 8.1 Responsabilidad

Comics Service administra el catálogo de cómics:

- título,
- autor,
- editorial,
- género,
- precio de alquiler,
- estado activo.

### 8.2 Puerto

```text
Host:      3002
Container: 3002
```

Endpoint GraphQL:

```text
http://localhost:3002/graphql
```

### 8.3 Operaciones GraphQL

Queries:

```graphql
comics
comic(id: Int!)
```

Mutation:

```graphql
createComic(input: CreateComicInput!)
```

El servicio utiliza GraphiQL para realizar pruebas directas en desarrollo.

### 8.4 Persistencia

Comics Service utiliza Prisma y PostgreSQL. Al iniciar el contenedor se ejecutan las migraciones de Prisma antes de iniciar la aplicación.

---

## 9. Rentals Service

### 9.1 Responsabilidad

Rentals Service administra:

- creación de alquileres,
- búsqueda de alquileres,
- alquileres por usuario,
- fecha límite,
- precio aplicado,
- estado del alquiler,
- devolución.

Además, coordina la comunicación directa con Comics Service y Copies Service.

### 9.2 Puerto

```text
Host:      8001
Container: 8001
```

GraphQL:

```text
http://localhost:8001/graphql
```

Health check de aplicación:

```text
http://localhost:8001/health
```

### 9.3 Operaciones GraphQL

Queries:

```graphql
rentals
rental(id: Int!)
rentalsByUser(userId: Int!)
```

Mutations:

```graphql
createRental(input: CreateRentalInput!)
returnRental(id: Int!)
```

El input de creación recibe conceptualmente:

```text
userId
comicId
dias
```

El usuario externo no envía `userId` a través del Gateway: el Gateway lo obtiene de la sesión autenticada.

Tampoco se solicita al cliente el precio ni el ejemplar físico. Estos valores son resueltos por Rentals Service mediante comunicación con otros microservicios.

### 9.4 Creación distribuida de un alquiler

El flujo es:

1. El Gateway obtiene el usuario autenticado.
2. Rentals Service recibe `userId`, `comicId` y `dias`.
3. Rentals consulta Comics Service.
4. Se valida que el cómic exista y esté activo.
5. Se obtiene `precioAlquiler` desde Comics Service.
6. Rentals consulta Copies Service.
7. Copies devuelve un ejemplar disponible.
8. Rentals solicita marcar el ejemplar como `ALQUILADO`.
9. Rentals guarda el alquiler en `rentals_db`.

Si falla la persistencia del alquiler después de reservar la copia, Rentals intenta compensar la operación solicitando nuevamente a Copies que el ejemplar quede disponible.

### 9.5 Devolución distribuida

Durante una devolución:

1. Se verifica que el alquiler exista.
2. Se verifica que su estado sea `ACTIVO`.
3. Rentals solicita a Copies que el ejemplar vuelva a `DISPONIBLE`.
4. El alquiler pasa a `DEVUELTO`.
5. Se registra `fecha_devolucion`.

Si falla la actualización local después de liberar la copia, se intenta compensar marcando nuevamente el ejemplar como alquilado.

---

## 10. Copies Service

### 10.1 Responsabilidad

Copies Service mantiene los ejemplares físicos asociados lógicamente a los cómics y administra su disponibilidad.

Estados utilizados:

```text
DISPONIBLE
ALQUILADO
```

### 10.2 Puerto

```text
Host:      8002
Container: 8002
```

Swagger automático de FastAPI:

```text
http://localhost:8002/docs
```

Health:

```text
http://localhost:8002/health
```

### 10.3 Endpoints internos

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/copies` | Crea un ejemplar |
| GET | `/copies` | Lista los ejemplares |
| GET | `/copies/by-comic/{comic_id}` | Lista ejemplares de un cómic |
| GET | `/copies/available/by-comic/{comic_id}` | Obtiene un ejemplar disponible |
| GET | `/copies/{copy_id}` | Consulta un ejemplar |
| PATCH | `/copies/{copy_id}/rent` | Cambia el estado a `ALQUILADO` |
| PATCH | `/copies/{copy_id}/return` | Cambia el estado a `DISPONIBLE` |

Los endpoints `rent` y `return` son utilizados por Rentals Service durante el flujo distribuido.

---

## 11. Contrato público del API Gateway

La API pública se encuentra documentada con Swagger/OpenAPI.

### 11.1 Authentication

| Método | Ruta | Autenticación | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | No | Registra un usuario |
| POST | `/api/auth/login` | No | Inicia sesión y establece `access_token` |

### 11.2 Comics

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/comics` | Admin, Cliente | Lista el catálogo |
| GET | `/api/comics/{id}` | Admin, Cliente | Consulta un cómic |
| POST | `/api/comics` | Admin | Registra un cómic |

### 11.3 Rentals

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| POST | `/api/rentals` | Admin, Cliente | Crea un alquiler |
| GET | `/api/rentals/me` | Admin, Cliente | Consulta alquileres del usuario autenticado |
| GET | `/api/rentals/{id}` | Admin o propietario | Consulta un alquiler |
| PATCH | `/api/rentals/{id}/return` | Admin o propietario | Devuelve un alquiler |

### 11.4 Copies

| Método | Ruta | Roles | Descripción |
|---|---|---|---|
| GET | `/api/copies/by-comic/{comicId}` | Admin, Cliente | Lista ejemplares de un cómic |
| GET | `/api/copies/available/by-comic/{comicId}` | Admin, Cliente | Obtiene un ejemplar disponible |
| POST | `/api/copies` | Admin | Registra un ejemplar físico |

El contrato completo y los códigos de respuesta están disponibles en:

```text
docs/swagger/Contrato.json
```

[Ver contrato OpenAPI](./swagger/Contrato.json)

---

## 12. Persistencia y bases de datos

Cada microservicio es propietario de su propia base de datos.

| Servicio | Base | Contenedor DB | Puerto host | Puerto interno |
|---|---|---|---:|---:|
| Auth | `auth_db` | `auth-db` | 5433 | 5432 |
| Comics | `comics_db` | `comics-db` | 5434 | 5432 |
| Rentals | `rentals_db` | `rentals-db` | 5435 | 5432 |
| Copies | `copies_db` | `copies-db` | 5436 | 5432 |

No existe una base de datos compartida.

### 12.1 Volúmenes Docker

Aunque los volúmenes no se muestran como elementos principales del diagrama UML de despliegue, Docker Compose define persistencia independiente para cada PostgreSQL:

```text
auth_db_data
comics_db_data
rentals_db_data
copies_db_data
```

Estos volúmenes se montan en:

```text
/var/lib/postgresql/data
```

y permiten conservar los datos aunque el contenedor de PostgreSQL sea recreado.

### 12.2 Referencias entre dominios

No se utilizan Foreign Keys entre bases de datos distintas.

Por ejemplo, `rentals_db` almacena:

```text
user_id
comic_id
copy_id
```

como referencias lógicas.

De forma similar:

```text
comic_copies.comic_id
```

es una referencia lógica al catálogo, pero no una FK física hacia `comics_db`.

La consistencia entre estos datos se resuelve mediante comunicación entre los microservicios.

---

## 13. Modelos de datos

### 13.1 Auth Service

Entidades:

```text
Role
- id
- nombre

User
- id
- nombre
- correo
- contrasena
- roleId
```

Relación física:

```text
Role 1 ---- N User
```

`roleId` es una Foreign Key hacia `roles.id`.

![ER Auth Service](./diagramas/ER-MicroservicioAuthService.png)

### 13.2 Comics Service

Entidad `Comic`:

```text
id
titulo
autor
editorial
genero
precioAlquiler
activo
createdAt
updatedAt
```

![ER Comics Service](./diagramas/ER-MicroservicioComicService.png)

### 13.3 Rentals Service

Entidad `Rental`:

```text
id
user_id
comic_id
copy_id
fecha_alquiler
fecha_limite
fecha_devolucion
precio_alquiler
estado
```

`user_id`, `comic_id` y `copy_id` son referencias lógicas y no Foreign Keys hacia otras bases.

![ER Rentals Service](./diagramas/ER-MicroservicioRentalsService.png)

### 13.4 Copies Service

Entidad `ComicCopy`:

```text
id
comic_id
codigo
estado
created_at
updated_at
```

`codigo` es único. Existen índices sobre `comic_id` y `estado`.

![ER Copies Service](./diagramas/ER-MicroservicioCopiesService.png)

---

## 14. Diagrama de despliegue

El sistema se despliega localmente mediante Docker Compose. El cliente accede principalmente al API Gateway y los servicios se comunican mediante la red interna creada por Compose.

![Diagrama de Despliegue](./diagramas/DiagramaDespliegue.png)

El despliegue contiene:

- 1 API Gateway.
- 4 microservicios.
- 4 contenedores PostgreSQL.

En total, Docker Compose administra nueve contenedores de aplicación/base de datos.

---

## 15. Puertos

### 15.1 Aplicaciones

| Componente | Host | Contenedor |
|---|---:|---:|
| API Gateway | 3000 | 3000 |
| Auth Service | 3001 | 3001 |
| Comics Service | 3002 | 3002 |
| Rentals Service | 8001 | 8001 |
| Copies Service | 8002 | 8002 |

### 15.2 Bases de datos

| Base | Host | Contenedor |
|---|---:|---:|
| Auth DB | 5433 | 5432 |
| Comics DB | 5434 | 5432 |
| Rentals DB | 5435 | 5432 |
| Copies DB | 5436 | 5432 |

Los puertos de host permiten pruebas locales. Dentro de Docker los contenedores se comunican utilizando el nombre del servicio y su puerto interno.

Ejemplo:

```text
http://comics-service:3002/graphql
http://copies-service:8002
```

No se utiliza `localhost` para comunicación entre contenedores.

---

## 16. Variables de entorno

El archivo `.env.example` contiene la plantilla de configuración. Para ejecutar la solución debe existir un archivo `.env` en la raíz de `P4`.

Crear la copia en PowerShell:

```powershell
Copy-Item .env.example .env
```

Variables requeridas:

```env
# AUTH SERVICE
AUTH_DB_USER=auth_user
AUTH_DB_PASSWORD=auth_password
AUTH_DB_NAME=auth_db
AUTH_DB_PORT=5433
AUTH_SERVICE_PORT=3001
AUTH_JWT_SECRET=REEMPLAZAR_CON_SECRETO_JWT
AUTH_ENCRYPTION_KEY=REEMPLAZAR_CON_LLAVE_HEXADECIMAL_DE_64_CARACTERES
JWT_EXPIRES_IN=60
JWT_REFRESH_TIME_SECONDS=60

# COMICS SERVICE
COMICS_DB_USER=comics_user
COMICS_DB_PASSWORD=comics_password
COMICS_DB_NAME=comics_db
COMICS_DB_PORT=5434
COMICS_SERVICE_PORT=3002

# RENTALS SERVICE
RENTALS_DB_USER=rentals_user
RENTALS_DB_PASSWORD=rentals_password
RENTALS_DB_NAME=rentals_db
RENTALS_DB_PORT=5435
RENTALS_SERVICE_PORT=8001
RENTALS_COMICS_SERVICE_URL=http://comics-service:3002/graphql
RENTALS_COPIES_SERVICE_URL=http://copies-service:8002
RENTALS_HTTP_TIMEOUT_SECONDS=5

# COPIES SERVICE
COPIES_DB_USER=copies_user
COPIES_DB_PASSWORD=copies_password
COPIES_DB_NAME=copies_db
COPIES_DB_PORT=5436
COPIES_SERVICE_PORT=8002

# API GATEWAY
GATEWAY_PORT=3000
GATEWAY_AUTH_SERVICE_URL=http://auth-service:3001
GATEWAY_COMICS_SERVICE_URL=http://comics-service:3002/graphql
GATEWAY_RENTALS_SERVICE_URL=http://rentals-service:8001/graphql
GATEWAY_COPIES_SERVICE_URL=http://copies-service:8002
GATEWAY_HTTP_TIMEOUT_MS=5000
```

### 16.1 Generación de llaves de ejemplo

Para generar un valor hexadecimal aleatorio de 32 bytes:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

El resultado puede utilizarse como llave de cifrado porque produce 64 caracteres hexadecimales.

No se debe subir el archivo `.env` con secretos reales al repositorio.

---

## 17. Ejecución con Docker Compose

### 17.1 Prerrequisitos

Para levantar el sistema completo mediante contenedores se requiere:

- Docker Desktop.
- Docker Compose.
- Git para clonar el repositorio.
- Navegador web para Swagger.

No es necesario instalar Node.js o Python localmente cuando toda la solución se ejecuta mediante Docker.

### 17.2 Construcción e inicio

Ubicarse en:

```text
P4/
```

Ejecutar:

```powershell
docker compose --env-file .env up --build
```

Para iniciar en segundo plano:

```powershell
docker compose --env-file .env up -d --build
```

### 17.3 Ver estado

```powershell
docker compose ps
```

Se espera que las bases de datos alcancen estado `healthy` y los servicios permanezcan activos.

### 17.4 Ver logs

Todos los servicios:

```powershell
docker compose logs -f
```

Un servicio específico:

```powershell
docker compose logs -f api-gateway
```

Ejemplo para Rentals:

```powershell
docker compose logs -f rentals-service
```

### 17.5 Detener

```powershell
docker compose down
```

Este comando elimina los contenedores y la red creada por Compose, pero conserva los volúmenes.

Para eliminar también los datos persistidos:

```powershell
docker compose down -v
```

> **Advertencia:** `-v` elimina los volúmenes y, por lo tanto, las bases de datos almacenadas.

---

## 18. Orden de arranque

Docker Compose utiliza dependencias para coordinar el inicio.

Auth Service depende de:

```text
auth-db → healthy
```

Comics Service depende de:

```text
comics-db → healthy
```

Rentals Service depende de:

```text
rentals-db → healthy
comics-service → started
copies-service → started
```

Copies Service depende de:

```text
copies-db → healthy
```

API Gateway depende del inicio de:

```text
auth-service
comics-service
rentals-service
copies-service
```

Auth y Comics ejecutan además:

```text
npx prisma migrate deploy
```

antes de iniciar su aplicación.

Rentals y Copies crean sus tablas con SQLAlchemy durante el ciclo de inicio de FastAPI.

---

## 19. Pruebas mediante Swagger

La forma recomendada de probar el contrato público es:

```text
http://localhost:3000/docs
```

Swagger se encuentra configurado con credenciales para permitir el uso de la cookie `access_token`.

### 19.1 Flujo de prueba recomendado

#### Paso 1 — Registrar usuario

```http
POST /api/auth/register
```

Ejemplo:

```json
{
  "nombre": "Administrador ComicRent",
  "correo": "admin@comicrent.com",
  "contrasena": "Clave123!",
  "rol": "Admin"
}
```

#### Paso 2 — Login

```http
POST /api/auth/login
```

```json
{
  "correo": "admin@comicrent.com",
  "contrasena": "Clave123!"
}
```

El navegador debe recibir y conservar la cookie:

```text
access_token
```

#### Paso 3 — Crear cómic

```http
POST /api/comics
```

```json
{
  "titulo": "Batman: Año Uno",
  "autor": "Frank Miller",
  "editorial": "DC Comics",
  "genero": "Superheroes",
  "precioAlquiler": 25
}
```

#### Paso 4 — Crear ejemplares

```http
POST /api/copies
```

```json
{
  "comicId": 1,
  "codigo": "BAT-001"
}
```

Se pueden crear más ejemplares con códigos diferentes.

#### Paso 5 — Crear alquiler

```http
POST /api/rentals
```

```json
{
  "comicId": 1,
  "dias": 7
}
```

No es necesario proporcionar `userId`, `copyId` ni `precioAlquiler`. El Gateway obtiene el usuario desde la sesión y Rentals obtiene el precio y ejemplar mediante los servicios responsables.

#### Paso 6 — Consultar alquileres

```http
GET /api/rentals/me
```

#### Paso 7 — Devolver

```http
PATCH /api/rentals/{id}/return
```

Después de la devolución, el ejemplar correspondiente debe volver a `DISPONIBLE`.

---

## 20. Pruebas directas de bases de datos

### Auth DB

```powershell
docker compose exec auth-db psql -U auth_user -d auth_db
```

### Comics DB

```powershell
docker compose exec comics-db psql -U comics_user -d comics_db -c "SELECT * FROM comics ORDER BY id;"
```

### Rentals DB

```powershell
docker compose exec rentals-db psql -U rentals_user -d rentals_db -c "SELECT * FROM rentals ORDER BY id;"
```

### Copies DB

```powershell
docker compose exec copies-db psql -U copies_user -d copies_db -c "SELECT * FROM comic_copies ORDER BY id;"
```

---

## 21. Códigos HTTP principales

| Código | Uso |
|---:|---|
| 200 | Consulta o acción completada |
| 201 | Recurso creado |
| 400 | Datos o estado de negocio inválido |
| 401 | Sesión inexistente, inválida o expirada |
| 403 | Usuario autenticado sin permisos |
| 404 | Recurso no encontrado |
| 409 | Conflicto de datos, por ejemplo un registro duplicado |
| 502 | Fallo de comunicación desde el Gateway hacia un microservicio |

---

## 22. Comunicación entre microservicios

### 22.1 Gateway hacia servicios

```text
api-gateway -> auth-service:3001
api-gateway -> comics-service:3002/graphql
api-gateway -> rentals-service:8001/graphql
api-gateway -> copies-service:8002
```

El Gateway utiliza un cliente centralizado encargado del transporte HTTP y aplica un timeout configurable mediante `GATEWAY_HTTP_TIMEOUT_MS`.

### 22.2 Rentals hacia Comics

```text
rentals-service
   |
   | HTTP / GraphQL
   v
comics-service:3002/graphql
```

Se utiliza para validar que el cómic exista, comprobar `activo` y obtener `precioAlquiler`.

### 22.3 Rentals hacia Copies

```text
rentals-service
   |
   | HTTP / REST
   v
copies-service:8002
```

Se utiliza para encontrar un ejemplar disponible, marcarlo `ALQUILADO` y regresarlo a `DISPONIBLE`.

El tiempo máximo de espera es configurable mediante `RENTALS_HTTP_TIMEOUT_SECONDS`.

---

## 23. Manejo de errores distribuidos

El API Gateway transforma errores de comunicación con los servicios en respuestas HTTP apropiadas.

Para llamadas GraphQL internas, el cliente del Gateway revisa la propiedad `errors` de la respuesta y transforma los errores GraphQL antes de responder al cliente.

Rentals Service utiliza `RemoteServiceError` para encapsular fallos de comunicación con Comics y Copies y convertirlos en errores de dominio GraphQL.

Además, el proceso de alquiler y devolución implementa compensaciones básicas para reducir inconsistencias si una operación remota se completa pero posteriormente falla la persistencia local.

---

## 24. Persistencia y migraciones

### 24.1 Auth Service

Usa Prisma y ejecuta:

```text
npx prisma migrate deploy
```

al iniciar el contenedor.

### 24.2 Comics Service

Usa Prisma y ejecuta:

```text
npx prisma migrate deploy
```

al iniciar el contenedor.

### 24.3 Rentals Service

Utiliza SQLAlchemy asíncrono y crea las tablas registradas en el modelo durante el `lifespan` de FastAPI.

### 24.4 Copies Service

Utiliza SQLAlchemy asíncrono y crea `comic_copies` durante el `lifespan` de FastAPI.

---

## 25. Dockerfiles

Existen Dockerfiles independientes para:

```text
api-gateway/Dockerfile
services/auth-service/Dockerfile
services/comics-service/Dockerfile
services/rentals-service/Dockerfile
services/copies-service/Dockerfile
```

Los componentes NestJS utilizan como base `node:22-bookworm-slim`.

Los componentes Python utilizan `python:3.12-slim`.

Cada imagen instala únicamente las dependencias del componente correspondiente, copia su código, expone su puerto y define su comando de inicio.

---

## 26. Documentación gráfica

El repositorio contiene seis diagramas técnicos.

### 26.1 Arquitectura general

Ruta:

```text
docs/diagramas/Arquitectura General.png
```

![Arquitectura General](./diagramas/Arquitectura%20General.png)

### 26.2 Despliegue UML

Ruta:

```text
docs/diagramas/DiagramaDespliegue.png
```

![Diagrama de Despliegue](./diagramas/DiagramaDespliegue.png)

### 26.3 ER — Auth Service

Ruta:

```text
docs/diagramas/ER-MicroservicioAuthService.png
```

![ER Auth Service](./diagramas/ER-MicroservicioAuthService.png)

### 26.4 ER — Comics Service

Ruta:

```text
docs/diagramas/ER-MicroservicioComicService.png
```

![ER Comics Service](./diagramas/ER-MicroservicioComicService.png)

### 26.5 ER — Copies Service

Ruta:

```text
docs/diagramas/ER-MicroservicioCopiesService.png
```

![ER Copies Service](./diagramas/ER-MicroservicioCopiesService.png)

### 26.6 ER — Rentals Service

Ruta:

```text
docs/diagramas/ER-MicroservicioRentalsService.png
```

![ER Rentals Service](./diagramas/ER-MicroservicioRentalsService.png)

---

## 27. Contrato OpenAPI

El contrato público se genera desde el API Gateway con Swagger.

Archivo versionado:

```text
docs/swagger/Contrato.json
```

Este documento describe rutas, métodos HTTP, parámetros, DTO de entrada, posibles respuestas, autenticación mediante `access_token` y agrupación por Authentication, Comics, Rentals y Copies.

Swagger UI permite ejecutar el contrato de forma interactiva en:

```text
http://localhost:3000/docs
```

---

## 28. Consideraciones de mantenimiento

Al modificar la solución debe respetarse la propiedad de datos de cada microservicio.

No se recomienda:

- consultar directamente la base de otro servicio;
- crear Foreign Keys entre bases pertenecientes a dominios diferentes;
- duplicar la lógica de autenticación dentro del Gateway;
- permitir que el cliente determine el precio de un alquiler;
- permitir que el cliente seleccione directamente el ejemplar asignado;
- exponer secretos reales en `.env.example` o en Git.

Si se agrega una nueva operación pública, debe actualizarse la documentación Swagger y volver a exportarse `docs/swagger/Contrato.json`.

Si cambia un modelo de Auth o Comics, deben mantenerse sus migraciones de Prisma. Si cambian los modelos SQLAlchemy, debe revisarse la estrategia de evolución del esquema correspondiente.

---

## 29. Solución de problemas

### El Gateway no inicia

```powershell
docker compose logs api-gateway
```

Confirmar que estén definidas las URLs `GATEWAY_*_SERVICE_URL`.

### Error de conexión a PostgreSQL

```powershell
docker compose ps
```

Confirmar que la base correspondiente se encuentre `healthy`.

### Swagger devuelve 401 después del login

Comprobar que el navegador recibió la cookie `access_token` y que la prueba se realiza desde:

```text
http://localhost:3000/docs
```

### No existen ejemplares disponibles

Consultar:

```http
GET /api/copies/available/by-comic/{comicId}
```

o revisar directamente `comic_copies`.

### El alquiler no puede devolverse

Verificar que el alquiler exista, tenga estado `ACTIVO`, el usuario sea propietario o `Admin`, y Copies Service se encuentre disponible.

---

## 30. Resumen técnico

ComicRent implementa una arquitectura distribuida compuesta por cuatro microservicios y un API Gateway. Cada microservicio mantiene responsabilidad sobre su propio dominio y persistencia. La integración utiliza tanto REST como GraphQL, mientras que Docker Compose permite levantar la solución completa en una sola ejecución.

La autenticación reutiliza el servicio de P2 con JWT en cookie HTTP-only, cifrado AES-256-CBC y roles. Rentals Service demuestra comunicación directa entre microservicios al consultar el catálogo y administrar la disponibilidad de los ejemplares. Finalmente, el API Gateway expone un contrato REST único documentado mediante OpenAPI/Swagger.
