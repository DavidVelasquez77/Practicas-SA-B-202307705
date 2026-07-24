import express, {
  Express,
  Request,
  Response,
} from "express";

import { databasePool } from "./config/db";

import { SolicitudRepository } from "./repositories/solicitud.repository";
import { SolicitudService } from "./services/solicitud.service";
import { SolicitudController } from "./controllers/solicitud.controller";
import { crearSolicitudesRouter } from "./routes/solicitudes.routes";

/**
 * Creación y configuración de Express.
 */
const app: Express = express();

/**
 * Evita exponer innecesariamente que el servidor utiliza Express.
 */
app.disable("x-powered-by");

/**
 * Permite recibir cuerpos de solicitudes en formato JSON.
 *
 * El límite evita aceptar cuerpos excesivamente grandes para una API
 * que únicamente administra registros pequeños.
 */
app.use(
  express.json({
    limit: "100kb",
  }),
);

/**
 * Composición de dependencias.
 *
 * Pool -> Repository -> Service -> Controller
 *
 * Esta es la única sección que conoce e instancia las implementaciones
 * concretas. Las capas internas reciben sus dependencias por constructor.
 */
const solicitudRepository = new SolicitudRepository(
  databasePool,
);

const solicitudService = new SolicitudService(
  solicitudRepository,
);

const solicitudController = new SolicitudController(
  solicitudService,
);

/**
 * Registro del router de solicitudes.
 */
app.use(
  "/api/solicitudes",
  crearSolicitudesRouter(solicitudController),
);

/**
 * Ruta opcional para verificar que la API está activa.
 */
app.get(
  "/health",
  (_req: Request, res: Response): void => {
    res.status(200).json({
      status: "ok",
      message: "API funcionando correctamente",
    });
  },
);

/**
 * Respuesta para rutas inexistentes.
 */
app.use(
  (_req: Request, res: Response): void => {
    res.status(404).json({
      message: "Ruta no encontrada",
    });
  },
);

const port = Number(process.env.PORT ?? 3000);

if (
  !Number.isInteger(port) ||
  port <= 0 ||
  port > 65535
) {
  throw new Error(
    "La variable PORT debe ser un número entero válido.",
  );
}

/**
 * Comprueba la conexión antes de iniciar el servidor.
 *
 * Si PostgreSQL no está disponible, la aplicación no queda escuchando
 * peticiones en un estado parcialmente funcional.
 */
async function iniciarServidor(): Promise<void> {
  try {
    await databasePool.query("SELECT 1");

    app.listen(port, (): void => {
      console.log(
        `Servidor ejecutándose en http://localhost:${port}`,
      );

      console.log(
        `API disponible en http://localhost:${port}/api/solicitudes`,
      );
    });
  } catch (error: unknown) {
    console.error(
      "No fue posible iniciar la aplicación porque falló la conexión con PostgreSQL:",
      error,
    );

    await databasePool.end();
    process.exit(1);
  }
}

void iniciarServidor();