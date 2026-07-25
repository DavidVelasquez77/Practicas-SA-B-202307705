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
import { errorMiddleware } from "./middlewares/error.middleware";

const app: Express = express();

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "100kb",
  }),
);

const solicitudRepository = new SolicitudRepository(
  databasePool,
);

const solicitudService = new SolicitudService(
  solicitudRepository,
);

const solicitudController = new SolicitudController(
  solicitudService,
);

app.use(
  "/api/solicitudes",
  crearSolicitudesRouter(solicitudController),
);

app.get(
  "/health",
  (_req: Request, res: Response): void => {
    res.status(200).json({
      status: "ok",
      message: "API funcionando correctamente",
    });
  },
);

app.use(
  (_req: Request, res: Response): void => {
    res.status(404).json({
      message: "Ruta no encontrada",
    });
  },
);

app.use(errorMiddleware);

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