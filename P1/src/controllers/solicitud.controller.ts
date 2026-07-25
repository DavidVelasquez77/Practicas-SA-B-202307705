import {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  ActualizarEstadoSolicitudInput,
  ActualizarSolicitudInput,
  CrearSolicitudInput,
} from "../models/solicitud.interface";

import { SolicitudService } from "../services/solicitud.service";

export class SolicitudController {
  constructor(
    private readonly solicitudService: SolicitudService,
  ) {}

  public obtenerTodas = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const solicitudes =
        await this.solicitudService.obtenerTodas();

      res.status(200).json(solicitudes);
    } catch (error: unknown) {
      next(error);
    }
  };

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

  public actualizarCompleta = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const datos = req.body as ActualizarSolicitudInput;

      const solicitudActualizada =
        await this.solicitudService.actualizarCompleta(
          id,
          datos,
        );

      res.status(200).json(solicitudActualizada);
    } catch (error: unknown) {
      next(error);
    }
  };

  public actualizarEstado = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = Number(req.params.id);
      const datos =
        req.body as ActualizarEstadoSolicitudInput;

      const solicitudActualizada =
        await this.solicitudService.actualizarEstado(
          id,
          datos,
        );

      res.status(200).json(solicitudActualizada);
    } catch (error: unknown) {
      next(error);
    }
  };

  public eliminar = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = Number(req.params.id);

      await this.solicitudService.eliminar(id);

      res.status(204).send();
    } catch (error: unknown) {
      next(error);
    }
  };
}