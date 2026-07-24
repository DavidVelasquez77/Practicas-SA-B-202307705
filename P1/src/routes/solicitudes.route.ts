import { Router } from "express";

import { SolicitudController } from "../controllers/solicitud.controller";

/**
 * Construye y devuelve el enrutador de solicitudes.
 *
 * El controlador se recibe desde el exterior para evitar crear
 * dependencias dentro de la capa de rutas.
 */
export function crearSolicitudesRouter(
  solicitudController: SolicitudController,
): Router {
  const router = Router();

  router.get(
    "/",
    solicitudController.obtenerTodas,
  );

  router.post(
    "/",
    solicitudController.registrarNueva,
  );

  router.put(
    "/:id",
    solicitudController.actualizarCompleta,
  );

  router.patch(
    "/:id/estado",
    solicitudController.actualizarEstado,
  );

  router.delete(
    "/:id",
    solicitudController.eliminar,
  );

  return router;
}