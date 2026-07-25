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