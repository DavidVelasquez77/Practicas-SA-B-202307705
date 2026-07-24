/**
 * Error base de la aplicación.
 *
 * Permite que el futuro controlador trate todos los errores conocidos
 * de forma genérica, sin depender de cada clase concreta.
 */
export abstract class AppError extends Error {
  protected constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message);

    this.name = new.target.name;

    // Conserva correctamente la cadena de herencia al extender Error.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Representa errores provocados por datos de entrada inválidos.
 * El futuro controlador podrá convertirlo en una respuesta HTTP 400.
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR");
  }
}

/**
 * Representa operaciones realizadas sobre un recurso inexistente.
 * El futuro controlador podrá convertirlo en una respuesta HTTP 404.
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id: number) {
    super(
      `${resource} con id ${id} no fue encontrado.`,
      404,
      "NOT_FOUND",
    );
  }
}