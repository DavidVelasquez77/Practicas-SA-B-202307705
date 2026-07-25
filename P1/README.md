# Aplicación de Principios SOLID

En este proyecto se aplicaron los principios SOLID con el objetivo de mantener una API REST organizada, mantenible, segura y fácil de extender. La aplicación fue estructurada por capas, separando controladores, servicios, repositorios, modelos, configuración, errores y middlewares.

La arquitectura general utilizada fue la siguiente:

```
Request HTTP
    ↓
Routes
    ↓
Controller
    ↓
Service
    ↓
Repository
    ↓
PostgreSQL
```

Esta separación permite que cada parte del sistema tenga una responsabilidad clara y evita mezclar lógica HTTP, reglas de negocio y consultas SQL en un mismo archivo.

## 1. S — Single Responsibility Principle

### Principio de Responsabilidad Única

#### Explicación 

El principio de responsabilidad única indica que cada clase, archivo o módulo debe encargarse de una sola cosa. Esto ayuda a que el código sea más fácil de entender, probar y modificar, porque si una parte cambia, no afecta responsabilidades que no le corresponden.

En esta API, cada capa tiene una función específica:

- El controlador maneja las peticiones y respuestas HTTP.
- El servicio contiene la lógica de negocio y validaciones.
- El repositorio se encarga únicamente de comunicarse con PostgreSQL.
- El middleware de errores transforma errores internos en respuestas HTTP seguras.
- Los modelos definen los tipos usados por la aplicación.

#### Evidencia en el código

**Archivo:** `src/controllers/solicitud.controller.ts`  
**Clase:** `SolicitudController`

```typescript
public registrarNueva = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const datos = req.body as CrearSolicitudInput;

    const solicitudCreada =
      await this.solicitudService.registrarNueva(datos);

    res.status(201).json(solicitudCreada);
  } catch (error: unknown) {
    next(error);
  }
};
```

##### Justificación

El controlador no valida reglas de negocio ni ejecuta consultas SQL. Solamente extrae los datos de la petición, llama al servicio y responde cuando la operación es exitosa. Si ocurre un error, lo delega al middleware global usando `next(error)`.

Esto cumple SRP porque el controlador se concentra únicamente en la comunicación HTTP.

#### Evidencia adicional

**Archivo:** `src/services/solicitud.service.ts`  
**Clase:** `SolicitudService`

```typescript
public async registrarNueva(
  datos: CrearSolicitudInput,
): Promise<Solicitud> {
  this.validarDatosCompletos(datos);

  const datosNormalizados: CrearSolicitudInput = {
    ...datos,
    titulo: datos.titulo.trim(),
    area_solicitante: datos.area_solicitante.trim(),
  };

  return this.solicitudRepository.registrarNueva(
    datosNormalizados,
  );
}
```

##### Justificación

El servicio se encarga de validar reglas de negocio antes de enviar los datos al repositorio. No conoce Express, no usa `Request`, no usa `Response` y tampoco ejecuta SQL. Su responsabilidad es procesar la lógica propia de las solicitudes operativas.

## 2. O — Open/Closed Principle

### Principio de Abierto/Cerrado

#### Explicación 

El principio abierto/cerrado indica que el código debe estar abierto para extenderse, pero cerrado para modificarse. Es decir, si se necesita agregar una nueva funcionalidad, lo ideal es agregar nuevas clases o métodos sin tener que modificar mucho código que ya funciona.

En este proyecto se aplicó principalmente mediante la jerarquía de errores. Todos los errores conocidos heredan de una clase base `AppError`, por lo que el middleware puede manejarlos de forma genérica.

#### Evidencia en el código

**Archivo:** `src/errors/app.error.ts`  
**Clase:** `AppError`

```typescript
export abstract class AppError extends Error {
  protected constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);

    this.name = new.target.name;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}
```

**Archivo:** `src/errors/app.error.ts`  
**Clases:** `ValidationError` y `NotFoundError`

```typescript
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: number) {
    super(
      `${resource} con id ${id} no fue encontrado.`,
      404,
      "NOT_FOUND",
    );
  }
}
```

##### Justificación

Si en el futuro se necesita agregar otro error, por ejemplo `ConflictError` o `UnauthorizedError`, solo se crea una nueva clase que extienda de `AppError`. No sería necesario modificar los controladores ni cambiar toda la estructura de manejo de errores.

#### Evidencia adicional

**Archivo:** `src/middlewares/error.middleware.ts`  
**Función:** `errorMiddleware`

```typescript
if (error instanceof AppError) {
  res.status(error.statusCode).json({
    code: error.code,
    message: error.message,
  });

  return;
}
```

##### Justificación

El middleware no necesita saber si el error específico es `ValidationError` o `NotFoundError`. Solo verifica si pertenece a la familia de `AppError` y responde usando sus propiedades. Esto permite extender el sistema con nuevos errores sin modificar la lógica principal del controlador.

## 3. L — Liskov Substitution Principle

### Principio de Sustitución de Liskov

#### Explicación

El principio de sustitución de Liskov indica que una clase hija debe poder usarse en lugar de su clase padre sin romper el funcionamiento del programa.

En este proyecto, los errores personalizados como `ValidationError`, `NotFoundError` y `DatabaseOperationError` pueden tratarse como `AppError` porque comparten las propiedades necesarias: `message`, `statusCode` y `code`.

#### Evidencia en el código

**Archivo:** `src/errors/app.error.ts`

```typescript
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: number) {
    super(
      `${resource} con id ${id} no fue encontrado.`,
      404,
      "NOT_FOUND",
    );
  }
}
```

##### Justificación

Ambos errores pueden ser usados donde se espera un `AppError`. El middleware no necesita condiciones separadas para cada uno porque ambos respetan la misma estructura.

Por ejemplo:

```typescript
if (error instanceof AppError) {
  res.status(error.statusCode).json({
    code: error.code,
    message: error.message,
  });
}
```

Aquí puede entrar un `ValidationError` o un `NotFoundError` sin romper el comportamiento esperado.

#### Evidencia adicional

**Archivo:** `src/errors/database-operation.error.ts`  
**Clase:** `DatabaseOperationError`

```typescript
export class DatabaseOperationError extends AppError {
  public readonly originalError: unknown;

  constructor(operation: string, originalError: unknown) {
    super(
      `No fue posible completar la operación: ${operation}.`,
      500,
      "DATABASE_ERROR",
    );

    this.originalError = originalError;

    Object.setPrototypeOf(
      this,
      DatabaseOperationError.prototype,
    );
  }
}
```

##### Justificación

`DatabaseOperationError` también puede comportarse como un `AppError`, porque contiene `statusCode` y `code`. Sin embargo, conserva una propiedad adicional llamada `originalError`, que permite registrar internamente el error real de PostgreSQL sin exponerlo al cliente.

Esto mantiene el contrato de `AppError` y permite sustituirlo en el middleware sin afectar el flujo general de errores.

## 4. I — Interface Segregation Principle

### Principio de Segregación de Interfaces

#### Explicación

El principio de segregación de interfaces indica que una clase no debería depender de métodos que no utiliza. Es mejor tener contratos pequeños y específicos en lugar de interfaces grandes con responsabilidades mezcladas.

En este proyecto, se definió una interfaz para el repositorio de solicitudes, con los métodos necesarios para gestionar solicitudes operativas. Esto permite que el servicio dependa de un contrato y no directamente de una clase concreta.

#### Evidencia en el código

**Archivo:** `src/repositories/solicitud.repository.interface.ts`  
**Interfaz:** `ISolicitudRepository`

```typescript
import {
  ActualizarEstadoSolicitudInput,
  ActualizarSolicitudInput,
  CrearSolicitudInput,
  Solicitud,
} from "../models/solicitud.interface";

export interface ISolicitudRepository {
  obtenerTodas(): Promise<Solicitud[]>;

  registrarNueva(
    datos: CrearSolicitudInput,
  ): Promise<Solicitud>;

  actualizarCompleta(
    id: number,
    datos: ActualizarSolicitudInput,
  ): Promise<Solicitud | null>;

  actualizarEstado(
    id: number,
    datos: ActualizarEstadoSolicitudInput,
  ): Promise<Solicitud | null>;

  eliminar(id: number): Promise<boolean>;
}
```

##### Justificación

La interfaz contiene únicamente las operaciones que necesita el servicio para trabajar con solicitudes operativas. No incluye detalles de conexión, configuración de PostgreSQL ni métodos internos como `ejecutarConsulta` o `mapRowToSolicitud`.

Esto evita que `SolicitudService` dependa de funciones que no le corresponden.

#### Evidencia adicional

**Archivo:** `src/repositories/solicitud.repository.ts`  
**Clase:** `SolicitudRepository`

```typescript
export class SolicitudRepository
  implements ISolicitudRepository {
  constructor(private readonly pool: Pool) {}

  public async obtenerTodas(): Promise<Solicitud[]> {
    // consulta a PostgreSQL
  }

  public async registrarNueva(
    datos: CrearSolicitudInput,
  ): Promise<Solicitud> {
    // inserción en PostgreSQL
  }
}
```

##### Justificación

La clase `SolicitudRepository` implementa el contrato definido por `ISolicitudRepository`. Si en el futuro se crea un repositorio en memoria para pruebas, este solo tendría que cumplir la misma interfaz.

**Nota:** Si el sistema creciera más, esta interfaz podría dividirse en interfaces más pequeñas, por ejemplo una de lectura y otra de escritura. Para el alcance actual de la práctica, la interfaz mantiene las operaciones necesarias sin exponer métodos internos.

## 5. D — Dependency Inversion Principle

### Principio de Inversión de Dependencias

#### Explicación 

El principio de inversión de dependencias indica que las clases de alto nivel no deberían depender directamente de clases de bajo nivel, sino de abstracciones. Esto ayuda a reducir el acoplamiento entre capas.

En este proyecto, las dependencias se reciben mediante constructores. Por ejemplo, el repositorio recibe el Pool, el servicio recibe el repositorio y el controlador recibe el servicio.

#### Evidencia en el código

**Archivo:** `src/services/solicitud.service.ts`  
**Clase:** `SolicitudService`

```typescript
constructor(
  private readonly solicitudRepository: ISolicitudRepository,
) {}
```

##### Justificación

`SolicitudService` no crea internamente un `SolicitudRepository`. En su lugar, recibe una dependencia desde afuera. Esto permite sustituir el repositorio real por otra implementación sin modificar la lógica de negocio.

Por ejemplo, para pruebas se podría usar un repositorio en memoria que implemente `ISolicitudRepository`.

#### Evidencia adicional

**Archivo:** `src/controllers/solicitud.controller.ts`  
**Clase:** `SolicitudController`

```typescript
constructor(
  private readonly solicitudService: SolicitudService,
) {}
```

##### Justificación

El controlador no instancia el servicio. Solo lo recibe por constructor. Esto reduce el acoplamiento entre capas y permite que la composición de dependencias se realice en un solo lugar.

#### Evidencia adicional de composición

**Archivo:** `src/index.ts`

```typescript
const solicitudRepository = new SolicitudRepository(
  databasePool,
);

const solicitudService = new SolicitudService(
  solicitudRepository,
);

const solicitudController = new SolicitudController(
  solicitudService,
);
```

##### Justificación

En `index.ts` se realiza la composición de dependencias:

```
Pool → Repository → Service → Controller
```

Esto permite que cada clase reciba lo que necesita sin construir sus propias dependencias internas.

---

## Evidencia adicional: Código Seguro y Limpio

Además de los principios SOLID, se implementaron medidas de seguridad y limpieza de código requeridas por la práctica.

### 1. Prevención de inyección SQL

**Archivo:** `src/repositories/solicitud.repository.ts`  
**Clase:** `SolicitudRepository`

```typescript
const consulta = `
  INSERT INTO solicitudes_operativas (
    titulo,
    area_solicitante,
    prioridad,
    costo_estimado,
    estado
  )
  VALUES ($1, $2, $3, $4, $5)
  RETURNING
    id,
    titulo,
    area_solicitante,
    prioridad,
    costo_estimado,
    estado;
`;

const parametros: SqlParameter[] = [
  datos.titulo,
  datos.area_solicitante,
  datos.prioridad,
  datos.costo_estimado,
  datos.estado,
];
```

##### Justificación

Los valores recibidos del cliente no se concatenan en el SQL. Se envían como parámetros usando `$1`, `$2`, `$3`, etc. Esto evita que un texto enviado por el usuario pueda alterar la consulta SQL.

### 2. PATCH limitado únicamente al estado

**Archivo:** `src/repositories/solicitud.repository.ts`  
**Método:** `actualizarEstado`

```typescript
const consulta = `
  UPDATE solicitudes_operativas
  SET estado = $1
  WHERE id = $2
  RETURNING
    id,
    titulo,
    area_solicitante,
    prioridad,
    costo_estimado,
    estado;
`;

const parametros: SqlParameter[] = [
  datos.estado,
  id,
];
```

##### Justificación

El endpoint PATCH solo actualiza la columna `estado`. No se permite modificar dinámicamente otras columnas ni se construye SQL a partir de campos enviados por el cliente.

Esto cumple con el requerimiento de actualizar exclusivamente el estado sin modificar el resto de atributos.

### 3. Validación de entradas

**Archivo:** `src/services/solicitud.service.ts`  
**Método:** `validarDatosCompletos`

```typescript
private validarDatosCompletos(
  datos: CrearSolicitudInput | ActualizarSolicitudInput,
): void {
  this.validarTexto(
    "titulo",
    datos.titulo,
  );

  this.validarTexto(
    "area_solicitante",
    datos.area_solicitante,
  );

  this.validarPrioridad(
    datos.prioridad,
  );

  this.validarCostoEstimado(
    datos.costo_estimado,
  );

  this.validarEstado(
    datos.estado,
  );
}
```

##### Justificación

Las validaciones están centralizadas en la capa de servicios. Esto evita duplicar lógica en los controladores y garantiza que las reglas de negocio se apliquen antes de llegar a la base de datos.

### 4. Manejo seguro de errores

**Archivo:** `src/middlewares/error.middleware.ts`  
**Middleware:** `errorMiddleware`

```typescript
if (esJsonInvalido(error)) {
  res.status(400).json({
    code: "INVALID_JSON",
    message:
      "El cuerpo de la solicitud contiene un JSON inválido.",
  });

  return;
}
if (error instanceof DatabaseOperationError) {
  console.error(
    "Error de base de datos:",
    error.originalError,
  );

  res.status(error.statusCode).json({
    code: error.code,
    message: "Error interno del servidor",
  });

  return;
}
```

##### Justificación

El middleware evita que errores internos, rutas locales, stack traces o detalles de PostgreSQL sean enviados al cliente. Los detalles técnicos se registran únicamente en la consola del servidor.

Esto fue agregado después de probar un JSON mal formado y detectar que Express respondía inicialmente con una página HTML con información interna del proyecto.

---

## Conclusión

La aplicación de los principios SOLID permitió construir una API REST con responsabilidades separadas, bajo acoplamiento y código más fácil de mantener. La estructura por capas facilita identificar dónde se encuentra cada parte del sistema:

- **Controller:** Comunicación HTTP
- **Service:** Lógica de negocio y validaciones
- **Repository:** Acceso a PostgreSQL
- **Errors:** Definición de errores conocidos
- **Middleware:** Transformación de errores en respuestas seguras
- **Models:** Contratos y tipos de datos

Además, se aplicaron prácticas de código seguro como:

- Consultas parametrizadas para prevenir inyección SQL
- Validación de entradas antes de procesar datos
- Manejo de errores controlado y seguro
- Ocultamiento de detalles internos del servidor
- Separación clara de responsabilidades entre capas