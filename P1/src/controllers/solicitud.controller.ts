import { Request, Response } from "express";

import {
  ActualizarEstadoSolicitudInput,
  ActualizarSolicitudInput,
  CrearSolicitudInput,
} from "../models/solicitud.interface";

import { SolicitudService } from "../services/solicitud.service";
import { AppError } from "../errors/app.error";

/**
 * Maneja exclusivamente la comunicación HTTP relacionada
 * con las solicitudes operativas.
 *
 * No contiene reglas de negocio ni consultas SQL.
 */
export class SolicitudController {
  /**
   * El servicio se recibe mediante inyección de dependencias.
   *
   * El controlador no crea el servicio internamente, lo que reduce
   * el acoplamiento y facilita sustituirlo durante las pruebas.
   */
  constructor(
    private readonly solicitudService: SolicitudService,
  ) {}

  /**
   * GET /api/solicitudes
   */
  public obtenerTodas = async (
    _req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const solicitudes =
        await this.solicitudService.obtenerTodas();

      res.status(200).json(solicitudes);
    } catch (error: unknown) {
      this.responderError(error, res);
    }
  };

  /**
   * POST /api/solicitudes
   */
  public registrarNueva = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      /*
       * El controlador únicamente extrae el body.
       * Las validaciones son responsabilidad del servicio.
       */
      const datos = req.body as CrearSolicitudInput;

      const solicitudCreada =
        await this.solicitudService.registrarNueva(datos);

      res.status(201).json(solicitudCreada);
    } catch (error: unknown) {
      this.responderError(error, res);
    }
  };

  /**
   * PUT /api/solicitudes/:id
   */
  public actualizarCompleta = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      /*
       * Number únicamente convierte el parámetro.
       * La validación del identificador se realiza en el servicio.
       */
      const id = Number(req.params.id);
      const datos = req.body as ActualizarSolicitudInput;

      const solicitudActualizada =
        await this.solicitudService.actualizarCompleta(
          id,
          datos,
        );

      res.status(200).json(solicitudActualizada);
    } catch (error: unknown) {
      this.responderError(error, res);
    }
  };

  /**
   * PATCH /api/solicitudes/:id/estado
   */
  public actualizarEstado = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const id = Number(req.params.id);

      /*
       * Para PATCH se extrae únicamente el tipo correspondiente
       * al campo estado. El servicio validará exclusivamente ese dato.
       */
      const datos =
        req.body as ActualizarEstadoSolicitudInput;

      const solicitudActualizada =
        await this.solicitudService.actualizarEstado(
          id,
          datos,
        );

      res.status(200).json(solicitudActualizada);
    } catch (error: unknown) {
      this.responderError(error, res);
    }
  };

  /**
   * DELETE /api/solicitudes/:id
   */
  public eliminar = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const id = Number(req.params.id);

      await this.solicitudService.eliminar(id);

      /*
       * HTTP 204 no debe incluir cuerpo en la respuesta.
       */
      res.status(204).send();
    } catch (error: unknown) {
      this.responderError(error, res);
    }
  };

  /**
   * Centraliza la transformación de errores a respuestas HTTP.
   *
   * AppError incluye los errores de validación y recurso no encontrado.
   * Los errores de PostgreSQL u otros errores desconocidos se ocultan
   * para no exponer información de infraestructura al cliente.
   */
  private responderError(
    error: unknown,
    res: Response,
  ): void {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({
        code: error.code,
        message: error.message,
      });

      return;
    }

    /*
     * El detalle se registra únicamente en el servidor.
     * Nunca se devuelve el error original de PostgreSQL al cliente.
     */
    console.error(
      "Error no controlado en SolicitudController:",
      error,
    );

    res.status(500).json({
      message: "Error interno del servidor",
    });
  }
}