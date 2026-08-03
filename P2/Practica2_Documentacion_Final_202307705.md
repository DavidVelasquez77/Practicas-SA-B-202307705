# Práctica 2 — Autenticación y Autorización

**Curso:** Software Avanzado  
**Autor:** Josué David Velásquez Ixchop  
**Carné:** 202307705  

---

# PARTE 1

## 1. Descripción del proyecto

Este proyecto implementa un módulo completo de autenticación y autorización para una aplicación web full stack.

La solución está construida como un **monolito centralizado**, en el cual el backend administra el registro de usuarios, inicio de sesión, generación y renovación de tokens, cifrado de información sensible y autorización por roles.

El sistema contempla dos roles:

- `Admin`
- `Cliente`

La autorización funciona de la siguiente manera:

| Rol | Ruta 1 | Ruta 2 |
|---|---|---|
| Admin | Permitido | Permitido |
| Cliente | Denegado | Permitido |

La arquitectura tecnológica utilizada es:

- **Backend:** NestJS.
- **Frontend:** Next.js con App Router.
- **ORM:** Prisma ORM 7.
- **Base de datos:** PostgreSQL.
- **Autenticación:** JWT.
- **Almacenamiento del token:** Cookie HTTP-only.
- **Encriptación:** AES-256-CBC.
- **Diseño:** Tailwind CSS con temática Samurái/Ronin.

---

## 2. Estructura general

```text
P2/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── auth/
│   │   ├── encryption/
│   │   ├── prisma/
│   │   ├── protected/
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── .env
│   └── package.json
│
└── frontend/
    ├── app/
    │   ├── dashboard/
    │   └── page.tsx
    ├── components/
    ├── hooks/
    ├── services/
    ├── types/
    └── package.json
```

---

## 3. Requisitos previos

Antes de ejecutar el proyecto, se debe contar con:

- Node.js instalado.
- npm instalado.
- PostgreSQL ejecutándose localmente.
- DBeaver o alguna herramienta similar para administrar PostgreSQL.
- Base de datos denominada `practica2_sa`.

La base de datos puede crearse con:

```sql
CREATE DATABASE practica2_sa;
```

---

## 4. Variables de entorno del backend

Crear el archivo:

```text
backend/.env
```

Agregar las siguientes variables:

```env
DATABASE_URL="postgresql://postgres:CONTRASENA@localhost:5432/practica2_sa?schema=public"

PORT=3000

ENCRYPTION_KEY="LLAVE_HEXADECIMAL_DE_64_CARACTERES"

JWT_SECRET="LLAVE_SECRETA_PARA_FIRMAR_LOS_TOKENS"

JWT_EXPIRES_IN=60

JWT_REFRESH_TIME_SECONDS=60
```

### DATABASE_URL

Define la conexión hacia PostgreSQL.

Formato:

```text
postgresql://USUARIO:CONTRASENA@HOST:PUERTO/BASE_DE_DATOS?schema=public
```

Ejemplo:

```env
DATABASE_URL="postgresql://postgres:admin123@localhost:5432/practica2_sa?schema=public"
```

### ENCRYPTION_KEY

Es una llave de 32 bytes utilizada por AES-256-CBC.

Puede generarse con:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

La salida debe tener 64 caracteres hexadecimales.

### JWT_SECRET

Se utiliza para firmar y verificar los tokens JWT.

Puede generarse con:

```bash
node -e "console.log(require('node:crypto').randomBytes(64).toString('hex'))"
```

### JWT_EXPIRES_IN

Define el tiempo de vida del JWT en segundos.

```env
JWT_EXPIRES_IN=60
```

### JWT_REFRESH_TIME_SECONDS

Define el tiempo de gracia disponible después de que el JWT haya expirado.

```env
JWT_REFRESH_TIME_SECONDS=60
```

El comportamiento configurado es:

```text
0–60 segundos:
JWT vigente.

61–120 segundos:
JWT expirado, pero renovable.

Después de 120 segundos:
La sesión se rechaza con 401 Unauthorized.
```

---

## 5. Instalación y ejecución del backend

Ingresar a la carpeta:

```bash
cd backend
```

Instalar las dependencias:

```bash
npm install
```

Validar el esquema de Prisma:

```bash
npx prisma validate
```

Formatear el esquema:

```bash
npx prisma format
```

Ejecutar las migraciones:

```bash
npx prisma migrate dev
```

En una instalación nueva también puede utilizarse:

```bash
npx prisma migrate dev --name init_auth
```

Generar Prisma Client:

```bash
npx prisma generate
```

Compilar el backend:

```bash
npm run build
```

Ejecutar en modo desarrollo:

```bash
npm run start:dev
```

El backend estará disponible en:

```text
http://localhost:3000
```

---

## 6. Instalación y ejecución del frontend

Abrir otra terminal e ingresar a:

```bash
cd frontend
```

Instalar dependencias:

```bash
npm install
```

Compilar el frontend:

```bash
npm run build
```

Ejecutar Next.js en el puerto 3001:

```bash
npm run dev -- --port 3001
```

El frontend estará disponible en:

```text
http://localhost:3001
```

---

## 7. Endpoints principales

### Registro

```http
POST /auth/register
```

Ejemplo:

```json
{
  "nombre": "Usuario Prueba",
  "correo": "usuario@prueba.com",
  "contrasena": "ClaveSegura123",
  "rol": "Admin"
}
```

Antes de guardar los datos, el backend cifra nombre, correo y contraseña.

### Login

```http
POST /auth/login
```

Ejemplo:

```json
{
  "correo": "usuario@prueba.com",
  "contrasena": "ClaveSegura123"
}
```

Si las credenciales son correctas, el backend genera un JWT y lo coloca en la cookie:

```text
access_token
```

La cookie utiliza:

```text
HttpOnly: true
Secure: false
SameSite: Lax
```

El token no se devuelve dentro del cuerpo JSON.

### Ruta 1

```http
GET /protected/ruta1
```

Acceso permitido únicamente para:

```text
Admin
```

### Ruta 2

```http
GET /protected/ruta2
```

Acceso permitido para:

```text
Admin
Cliente
```

---

## 8. Tecnologías utilizadas

### 8.1 NestJS

NestJS es un framework para Node.js orientado al desarrollo de aplicaciones del lado del servidor. Utiliza TypeScript y organiza el código mediante módulos, controladores, servicios, decoradores, estrategias y guardianes.

**Ventajas**

- Proporciona una estructura modular clara.
- Incluye inyección de dependencias.
- Facilita la aplicación de principios SOLID.
- Permite separar controladores, servicios y acceso a datos.
- Se integra con Passport, JWT, Prisma y Express.

**Desventajas**

- Requiere conocer decoradores e inyección de dependencias.
- Puede resultar más complejo que Express para proyectos pequeños.
- Una mala organización de módulos puede generar dependencias circulares.
- Tiene una curva de aprendizaje mayor que una API básica de Node.js.

### 8.2 Next.js

Next.js es un framework basado en React que permite construir aplicaciones web modernas. En este proyecto se utilizó App Router.

**Ventajas**

- Permite crear rutas mediante carpetas.
- Está integrado con React y TypeScript.
- Facilita la separación entre componentes de servidor y cliente.
- Tiene soporte directo para Tailwind CSS.
- Permite modularizar componentes, hooks, servicios y tipos.

**Desventajas**

- Es necesario entender la diferencia entre componentes cliente y servidor.
- Algunas funciones de React requieren agregar `"use client"`.
- Puede ser excesivo para una interfaz demasiado pequeña.
- Su estructura y comportamiento cambian entre versiones importantes.

### 8.3 Prisma ORM

Prisma es un ORM que permite acceder a bases de datos mediante código TypeScript tipado.

**Ventajas**

- Proporciona autocompletado y tipado.
- Reduce la escritura manual de consultas SQL.
- Permite gestionar cambios mediante migraciones.
- Define los modelos en un archivo centralizado.
- Facilita relaciones entre entidades como `User` y `Role`.

**Desventajas**

- Se debe regenerar Prisma Client después de modificar el esquema.
- Agrega una capa de abstracción sobre SQL.
- Algunas consultas complejas pueden requerir mayor conocimiento del ORM.
- Una configuración incorrecta del generador puede causar problemas de compilación.

### 8.4 PostgreSQL

PostgreSQL es un sistema gestor de bases de datos relacional utilizado para almacenar usuarios, roles y migraciones.

**Ventajas**

- Es gratuito y de código abierto.
- Soporta relaciones, restricciones e índices.
- Tiene buen manejo de integridad referencial.
- Es compatible con Prisma.
- Es robusto para aplicaciones pequeñas y empresariales.

**Desventajas**

- Requiere instalación y configuración local.
- La cadena de conexión debe protegerse.
- Puede requerir conocimientos de administración y SQL.
- El servicio debe estar iniciado antes de ejecutar el backend.

---

## 9. Seguridad implementada

### 9.1 JWT

JWT significa **JSON Web Token**.

Es un formato utilizado para transportar información firmada entre el cliente y el servidor. Un JWT está formado por tres partes:

```text
Header.Payload.Signature
```

En este proyecto, el JWT contiene:

- Identificador del usuario.
- Rol.
- Fecha de emisión.
- Fecha de expiración.
- Límite absoluto para renovación.

El token se firma con `JWT_SECRET`, permitiendo al backend detectar alteraciones.

### 9.2 Renovación automática del JWT

El JWT tiene un tiempo de vida definido con:

```env
JWT_EXPIRES_IN=60
```

Después de expirar, puede renovarse durante el tiempo configurado en:

```env
JWT_REFRESH_TIME_SECONDS=60
```

La estrategia funciona así:

```text
JWT vigente
→ la petición continúa normalmente.

JWT expirado dentro del tiempo de gracia
→ se genera un JWT nuevo.
→ se reemplaza la cookie access_token.
→ la petición continúa.

JWT fuera del tiempo de gracia
→ se elimina o rechaza la cookie.
→ se responde 401 Unauthorized.
```

El claim `refreshUntil` evita que cada renovación reinicie indefinidamente el tiempo máximo original de la sesión.

### 9.3 AES-256-CBC

AES significa **Advanced Encryption Standard**.

Es un algoritmo de cifrado simétrico. Esto significa que la misma llave se utiliza para cifrar y descifrar la información.

En este proyecto se utiliza:

```text
AES-256-CBC
```

Sus principales características son:

- Llave de 256 bits, equivalente a 32 bytes.
- Vector de inicialización aleatorio de 16 bytes.
- Cifrado bidireccional.
- El texto original puede recuperarse mediante la llave correcta.

El formato almacenado es:

```text
iv:ciphertext
```

Los siguientes campos se cifran antes de almacenarse:

- Nombre.
- Correo.
- Contraseña.

### 9.4 Cookies HTTP-only

Una cookie HTTP-only es una cookie que no puede ser leída mediante JavaScript ejecutado en el navegador.

En el proyecto, el JWT se guarda de esta forma:

```typescript
response.cookie('access_token', token, {
  httpOnly: true,
  secure: false,
  sameSite: 'lax',
  path: '/',
});
```

El frontend utiliza:

```typescript
credentials: 'include'
```

para que el navegador almacene y envíe automáticamente la cookie en las solicitudes hacia el backend.

### 9.5 Uso conjunto de JWT, AES y cookies HTTP-only

```text
AES-256-CBC
→ protege la información almacenada en PostgreSQL.

JWT
→ representa la identidad y rol del usuario autenticado.

Cookie HTTP-only
→ transporta el JWT sin exponerlo al JavaScript del frontend.
```

---

## 10. Diagrama de secuencia

```mermaid
sequenceDiagram
    autonumber

    actor Usuario
    participant Frontend as Frontend Next.js
    participant AuthController as AuthController
    participant AuthService as AuthService
    participant Encryption as EncryptionService (AES)
    participant Prisma as PrismaService
    participant DB as PostgreSQL
    participant JwtService as JwtService
    participant JwtGuard as JwtAuthGuard
    participant JwtStrategy as JwtStrategy
    participant RoleGuard as UserRoleGuard
    participant Protected as ProtectedController

    Usuario->>Frontend: Ingresa correo y contraseña
    Frontend->>AuthController: POST /auth/login<br/>credentials: include

    AuthController->>AuthService: login(loginDto)
    AuthService->>Prisma: user.findMany()
    Prisma->>DB: SELECT usuarios y roles
    DB-->>Prisma: Registros cifrados
    Prisma-->>AuthService: Usuarios cifrados

    loop Buscar el correo ingresado
        AuthService->>Encryption: decrypt(usuario.correo)
        Encryption-->>AuthService: Correo descifrado
        AuthService->>AuthService: Comparar correos
    end

    alt Usuario encontrado
        AuthService->>Encryption: decrypt(usuario.contrasena)
        Encryption-->>AuthService: Contraseña descifrada
        AuthService->>AuthService: Comparar contraseña
    end

    alt Credenciales incorrectas
        AuthService-->>AuthController: UnauthorizedException
        AuthController-->>Frontend: 401 Unauthorized
        Frontend-->>Usuario: Mostrar mensaje de error
    else Credenciales correctas
        AuthService->>AuthService: Calcular refreshUntil
        AuthService->>JwtService: signAsync({sub, role, refreshUntil})
        JwtService-->>AuthService: accessToken
        AuthService-->>AuthController: accessToken y datos del usuario
        AuthController-->>Frontend: Set-Cookie access_token<br/>HttpOnly, SameSite=Lax
        AuthController-->>Frontend: 200 Inicio de sesión exitoso
        Frontend-->>Usuario: Redirección a /dashboard
    end

    Usuario->>Frontend: Presiona una ruta protegida
    Frontend->>JwtGuard: GET /protected/ruta1 o ruta2<br/>Cookie access_token

    JwtGuard->>JwtStrategy: Ejecutar estrategia JWT
    JwtStrategy->>JwtStrategy: Extraer token desde req.cookies
    JwtStrategy->>JwtStrategy: Verificar firma del JWT
    JwtStrategy->>JwtStrategy: Validar exp y refreshUntil

    alt JWT vigente
        JwtStrategy-->>JwtGuard: Usuario autenticado {id, role}
    else JWT expirado dentro del tiempo de gracia
        JwtStrategy->>JwtService: signAsync({sub, role, refreshUntil})
        JwtService-->>JwtStrategy: Nuevo JWT
        JwtStrategy-->>Frontend: Set-Cookie access_token renovada
        JwtStrategy-->>JwtGuard: Usuario autenticado {id, role}
    else JWT fuera del tiempo de gracia
        JwtStrategy-->>Frontend: 401 Unauthorized
        Frontend-->>Usuario: Mostrar sesión expirada
    end

    JwtGuard->>RoleGuard: Continuar con request.user
    RoleGuard->>RoleGuard: Leer roles con Reflector
    RoleGuard->>RoleGuard: Comparar rol del usuario

    alt Rol no autorizado
        RoleGuard-->>Frontend: 403 Forbidden
        Frontend-->>Usuario: Mostrar acceso denegado
    else Rol autorizado
        RoleGuard->>Protected: Permitir acceso al endpoint
        Protected-->>Frontend: 200 OK con mensaje de la ruta
        Frontend-->>Usuario: Mostrar resultado en el dashboard
    end
```
### Explicación general del diagrama de secuencia

El diagrama de secuencia representa la comunicación entre el usuario, el frontend, el backend y la base de datos durante los procesos de inicio de sesión y acceso a rutas protegidas. También muestra cómo intervienen la encriptación AES, el JWT, la cookie HTTP-only, la renovación automática del token y la validación de roles.

El flujo comienza cuando el usuario introduce su correo y contraseña en el formulario desarrollado con Next.js. El frontend envía estos datos al endpoint POST /auth/login del backend NestJS. La solicitud utiliza credentials: 'include' para permitir que el navegador reciba y gestione la cookie de autenticación.

El AuthController recibe la petición y delega la autenticación al AuthService. Este servicio consulta mediante PrismaService los usuarios almacenados en PostgreSQL. Debido a que los correos y contraseñas se encuentran cifrados con AES-256-CBC, el sistema utiliza EncryptionService para descifrarlos y compararlos con las credenciales proporcionadas por el usuario.

Si las credenciales son incorrectas, el backend devuelve una respuesta 401 Unauthorized. Si son correctas, AuthService genera un JWT mediante JwtService. El token incluye el identificador del usuario, su rol y el límite máximo durante el cual puede renovarse. Posteriormente, AuthController guarda el JWT en una cookie llamada access_token, configurada como HTTP-only para evitar que sea accesible desde JavaScript. Después del login exitoso, el frontend redirige al usuario hacia el dashboard.

Cuando el usuario presiona uno de los botones para probar una ruta protegida, el frontend realiza una solicitud incluyendo automáticamente la cookie. Antes de ejecutar el controlador, JwtAuthGuard activa JwtStrategy, que extrae el token desde request.cookies, verifica su firma y revisa sus tiempos de expiración.

Si el JWT todavía está vigente, la petición continúa normalmente. Si ya expiró, pero aún se encuentra dentro del tiempo de gracia configurado, el backend genera un nuevo JWT y reemplaza la cookie access_token sin mostrar el token al usuario. Si el token superó el límite permitido para la renovación, el backend responde con 401 Unauthorized.

Después de validar la autenticación, UserRoleGuard comprueba si el rol almacenado en request.user está autorizado para acceder al endpoint solicitado. Si el usuario no posee el rol requerido, se devuelve 403 Forbidden. Si el rol es válido, la petición llega al ProtectedController, que ejecuta la ruta correspondiente y devuelve una respuesta 200 OK.

En resumen, el diagrama demuestra que el sistema sigue una secuencia organizada: primero valida las credenciales, después genera y almacena el JWT de forma segura, posteriormente comprueba la vigencia o renovación del token y, finalmente, verifica los permisos del usuario antes de permitir el acceso al endpoint protegido.

---

# PARTE 2: DOCUMENTO DE PRINCIPIOS SOLID

## Aplicación de los principios SOLID

Los principios SOLID permiten organizar el código de forma que sea más fácil de comprender, mantener, probar y extender.

En este proyecto se aplican mediante servicios especializados, inyección de dependencias, guards, decoradores, interfaces y módulos de NestJS.

---

## 1. Principio de Responsabilidad Única — SRP

### Explicación teórica

El Principio de Responsabilidad Única indica que una clase debe tener una sola responsabilidad principal. Todos sus métodos deben estar relacionados con un mismo propósito.

### Archivo o clase

```text
src/encryption/encryption.service.ts
```

Clase:

```text
EncryptionService
```

### Justificación

`EncryptionService` tiene únicamente la responsabilidad de cifrar y descifrar cadenas de texto mediante AES-256-CBC.

No conoce Prisma, usuarios, roles, cookies ni JWT.

### Fragmento de código real

```typescript
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-cbc';
  private readonly key: Buffer;
  private readonly ivLength = 16;

  constructor(configService: ConfigService) {
    const encryptionKey =
      configService.getOrThrow<string>('ENCRYPTION_KEY');

    this.key = Buffer.from(encryptionKey, 'hex');
  }

  encrypt(text: string): string {
    const iv = randomBytes(this.ivLength);
    const cipher = createCipheriv(this.algorithm, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(encryptedText: string): string {
    const [ivHex, ciphertextHex] = encryptedText.split(':');

    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(ivHex, 'hex'),
    );

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
```

---

## 2. Principio Abierto/Cerrado — OCP

### Explicación teórica

El Principio Abierto/Cerrado establece que el sistema debe estar abierto para extenderse, pero cerrado para modificaciones innecesarias.

### Archivo o clase

```text
src/auth/decorators/auth.decorator.ts
src/auth/decorators/role-protected.decorator.ts
src/protected/protected.controller.ts
```

### Justificación

El decorador `@Auth()` permite aplicar autenticación JWT y autorización por roles a cualquier endpoint sin modificar la lógica interna de los guards.

### Fragmento de código real

```typescript
export function Auth(
  ...roles: UserRole[]
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    RoleProtected(...roles),
    UseGuards(
      JwtAuthGuard,
      UserRoleGuard,
    ),
  );
}
```

Uso:

```typescript
@Controller('protected')
export class ProtectedController {
  @Get('ruta1')
  @Auth(USER_ROLES.ADMIN)
  rutaSoloAdmin() {
    return {
      message: 'Acceso permitido para Admin',
    };
  }

  @Get('ruta2')
  @Auth(
    USER_ROLES.ADMIN,
    USER_ROLES.CLIENTE,
  )
  rutaCompartida() {
    return {
      message: 'Acceso permitido para Admin y Cliente',
    };
  }
}
```

---

## 3. Principio de Sustitución de Liskov — LSP

### Explicación teórica

El Principio de Sustitución de Liskov establece que una implementación concreta debe poder utilizarse en lugar del contrato que implementa sin romper el comportamiento esperado.

### Archivo o clase

```text
src/auth/guards/user-role.guard.ts
```

Clase:

```text
UserRoleGuard
```

Contrato:

```text
CanActivate
```

### Justificación

`UserRoleGuard` implementa correctamente el contrato `CanActivate`, por lo que NestJS puede ejecutarlo como cualquier otro guard compatible.

### Fragmento de código real

```typescript
@Injectable()
export class UserRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  canActivate(
    context: ExecutionContext,
  ): boolean {
    const allowedRoles =
      this.reflector.getAllAndOverride<UserRole[]>(
        ROLE_PROTECTED_KEY,
        [
          context.getHandler(),
          context.getClass(),
        ],
      );

    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const request =
      context.switchToHttp().getRequest<{
        user?: {
          id: number;
          role: UserRole;
        };
      }>();

    const user = request.user;

    if (!user || !allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        'No tiene permisos para acceder a esta ruta',
      );
    }

    return true;
  }
}
```

---

## 4. Principio de Segregación de Interfaces — ISP

### Explicación teórica

El Principio de Segregación de Interfaces indica que una clase no debería depender de propiedades o métodos que no necesita.

### Archivo o interfaz

```text
src/auth/types/authenticated-user.interface.ts
```

Interfaz:

```text
AuthenticatedUser
```

### Justificación

`UserRoleGuard` solamente necesita conocer el identificador del usuario y su rol. No necesita nombre, correo, contraseña ni token completo.

### Fragmento de código real

```typescript
export interface AuthenticatedUser {
  id: number;
  role: UserRole;
}
```

Uso:

```typescript
type AuthenticatedRequest = Request & {
  user?: AuthenticatedUser;
};
```

---

## 5. Principio de Inversión de Dependencias — DIP

### Explicación teórica

El Principio de Inversión de Dependencias establece que las clases de alto nivel no deben construir directamente sus dependencias. Deben recibirlas mediante abstracciones o mediante un contenedor de inyección de dependencias.

### Archivo o clase

```text
src/auth/auth.service.ts
```

Clase:

```text
AuthService
```

### Justificación

`AuthService` no crea manualmente `PrismaService`, `EncryptionService`, `JwtService` ni `ConfigService`. NestJS se encarga de inyectarlos.

### Fragmento de código real

```typescript
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}
}
```

Registro de dependencias:

```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

```typescript
@Global()
@Module({
  providers: [EncryptionService],
  exports: [EncryptionService],
})
export class EncryptionModule {}
```

---

## Conclusión sobre SOLID

La aplicación de SOLID permitió dividir el sistema en responsabilidades concretas:

```text
EncryptionService
→ cifrado y descifrado AES.

PrismaService
→ conexión y acceso a PostgreSQL.

AuthService
→ registro, login y emisión del JWT.

JwtStrategy
→ validación y renovación del token.

JwtAuthGuard
→ autenticación de rutas.

UserRoleGuard
→ autorización según roles.

AuthController
→ manejo HTTP y cookies.

ProtectedController
→ exposición de rutas de prueba.
```

Esta organización evita concentrar toda la lógica en una sola clase y facilita extender el proyecto sin modificar componentes que ya funcionan.
