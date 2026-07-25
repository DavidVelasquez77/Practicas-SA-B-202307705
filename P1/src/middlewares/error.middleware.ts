import {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from "express";

import { AppError } from "../errors/app.error";
import { DatabaseOperationError } from "../errors/database-operation.error";

interface JsonParseError extends SyntaxError {
  status?: number;
  type?: string;
}

function esJsonInvalido(
  error: unknown,
): error is JsonParseError {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  const jsonError = error as JsonParseError;

  return (
    jsonError.status === 400 &&
    jsonError.type === "entity.parse.failed"
  );
}

export const errorMiddleware: ErrorRequestHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (esJsonInvalido(error)) {
    res.status(400).json({
      code: "INVALID_JSON",
      message:
        "El cuerpo de la solicitud contiene un JSON inválido.",
    });

    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      code: error.code,
      message: error.message,
    });

    return;
  }

  if (error instanceof DatabaseOperationError) {
    console.error(
      "Error de base de datos:",
      error.originalError,
    );

    res.status(500).json({
      message: "Error interno del servidor",
    });

    return;
  }

  console.error(
    "Error no controlado:",
    error,
  );

  res.status(500).json({
    message: "Error interno del servidor",
  });
};