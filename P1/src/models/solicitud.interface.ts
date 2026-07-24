/**
 * Estados permitidos para una solicitud operativa.
 *
 * Este tipo ayuda a evitar valores inválidos durante el desarrollo.
 * La validación en tiempo de ejecución deberá realizarse en la capa
 * de servicios o mediante un middleware.
 */
export type EstadoSolicitud =
  | "registrada"
  | "en_proceso"
  | "finalizada";

/**
 * Representación que será utilizada por el resto de la aplicación.
 */
export interface Solicitud {
  id: number;
  titulo: string;
  area_solicitante: string;
  prioridad: number;
  costo_estimado: number;
  estado: EstadoSolicitud;
}

/**
 * Datos requeridos para registrar una solicitud.
 *
 * El id no se incluye porque será generado automáticamente
 * por PostgreSQL.
 */
export interface CrearSolicitudInput {
  titulo: string;
  area_solicitante: string;
  prioridad: number;
  costo_estimado: number;
  estado: EstadoSolicitud;
}

/**
 * Datos requeridos para una actualización completa mediante PUT.
 *
 * Todos los campos son obligatorios porque PUT reemplaza
 * completamente la información editable del recurso.
 */
export interface ActualizarSolicitudInput {
  titulo: string;
  area_solicitante: string;
  prioridad: number;
  costo_estimado: number;
  estado: EstadoSolicitud;
}

/**
 * Datos permitidos para actualizar exclusivamente el estado.
 *
 * Esta interfaz impide que el método PATCH reciba otros campos
 * como título, prioridad o costo.
 */
export interface ActualizarEstadoSolicitudInput {
  estado: EstadoSolicitud;
}