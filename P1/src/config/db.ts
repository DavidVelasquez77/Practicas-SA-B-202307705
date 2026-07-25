import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const {
  DB_USER,
  DB_PASSWORD,
  DB_HOST,
  DB_PORT,
  DB_NAME,
} = process.env;

if (
  !DB_USER ||
  !DB_PASSWORD ||
  !DB_HOST ||
  !DB_PORT ||
  !DB_NAME
) {
  throw new Error(
    "Faltan variables de entorno para conectar con PostgreSQL.",
  );
}

const parsedPort = Number(DB_PORT);

if (!Number.isInteger(parsedPort)) {
  throw new Error(
    "La variable DB_PORT debe contener un número entero.",
  );
}

if (
  !Number.isInteger(parsedPort) ||
  parsedPort <= 0 ||
  parsedPort > 65535
) {
  throw new Error(
    "La variable DB_PORT debe contener un puerto válido.",
  );
}

export const databasePool = new Pool({
  user: DB_USER,
  password: DB_PASSWORD,
  host: DB_HOST,
  port: parsedPort,
  database: DB_NAME,
});

/**
 * Los errores inesperados de conexiones inactivas se registran
 * internamente. No deben enviarse directamente al cliente.
 */
databasePool.on("error", (error: Error) => {
  console.error(
    "Error inesperado en el pool de PostgreSQL:",
    error,
  );
});