import { AppError } from "./app.error";

/**
 * Representa un error real de conexión o ejecución en PostgreSQL.
 *
 * El error original se conserva para registrarlo internamente,
 * pero no debe enviarse directamente al cliente porque podría
 * revelar información sensible de la base de datos.
 */
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