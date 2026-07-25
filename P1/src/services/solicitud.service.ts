import {
  ActualizarEstadoSolicitudInput,
  ActualizarSolicitudInput,
  CrearSolicitudInput,
  EstadoSolicitud,
  Solicitud,
} from "../models/solicitud.interface";

import { ISolicitudRepository } from "../repositories/solicitud.repository.interface";

import {
  NotFoundError,
  ValidationError,
} from "../errors/app.error";

/**
 * Contiene exclusivamente la lógica de negocio relacionada
 * con las solicitudes operativas.
 *
 * No conoce Express, peticiones HTTP ni consultas SQL.
 */
export class SolicitudService {
  private readonly estadosValidos: ReadonlySet<EstadoSolicitud> =
    new Set<EstadoSolicitud>([
      "registrada",
      "en_proceso",
      "finalizada",
    ]);

  /**
   * El repositorio se recibe desde el exterior.
   *
   * Esta inyección evita que el servicio cree o configure directamente
   * su dependencia, reduciendo el acoplamiento y facilitando las pruebas.
   */
  constructor(
    private readonly solicitudRepository: ISolicitudRepository,
  ) {}

  /**
   * Obtiene todas las solicitudes operativas.
   */
  public async obtenerTodas(): Promise<Solicitud[]> {
    return this.solicitudRepository.obtenerTodas();
  }

  /**
   * Valida y registra una nueva solicitud.
   */
  public async registrarNueva(
    datos: CrearSolicitudInput,
  ): Promise<Solicitud> {
    this.validarDatosCompletos(datos);

    const datosNormalizados: CrearSolicitudInput = {
      ...datos,
      titulo: datos.titulo.trim(),
      area_solicitante: datos.area_solicitante.trim(),
    };

    return this.solicitudRepository.registrarNueva(
      datosNormalizados,
    );
  }

  /**
   * Valida y actualiza completamente una solicitud existente.
   *
   * Si el repositorio devuelve null, el servicio lo convierte en un
   * error de negocio para que el controlador pueda responder con 404.
   */
  public async actualizarCompleta(
    id: number,
    datos: ActualizarSolicitudInput,
  ): Promise<Solicitud> {
    this.validarId(id);
    this.validarDatosCompletos(datos);

    const datosNormalizados: ActualizarSolicitudInput = {
      ...datos,
      titulo: datos.titulo.trim(),
      area_solicitante: datos.area_solicitante.trim(),
    };

    const solicitudActualizada =
      await this.solicitudRepository.actualizarCompleta(
        id,
        datosNormalizados,
      );

    if (solicitudActualizada === null) {
      throw new NotFoundError(
        "La solicitud operativa",
        id,
      );
    }

    return solicitudActualizada;
  }

  /**
   * Elimina una solicitud existente.
   *
   * El repositorio devuelve false cuando el id no existe. El servicio
   * transforma ese resultado en un NotFoundError.
   */
  public async eliminar(id: number): Promise<void> {
    this.validarId(id);

    const solicitudEliminada =
      await this.solicitudRepository.eliminar(id);

    if (!solicitudEliminada) {
      throw new NotFoundError(
        "La solicitud operativa",
        id,
      );
    }
  }

  /**
   * Actualiza exclusivamente el estado.
   *
   * Este método valida solamente el id y el campo estado. No exige
   * título, área, prioridad ni costo porque corresponde a un PATCH.
   */
  public async actualizarEstado(
    id: number,
    datos: ActualizarEstadoSolicitudInput,
  ): Promise<Solicitud> {
    this.validarId(id);
    this.validarEstado(datos.estado);

    const solicitudActualizada =
      await this.solicitudRepository.actualizarEstado(
        id,
        {
          estado: datos.estado,
        },
      );

    if (solicitudActualizada === null) {
      throw new NotFoundError(
        "La solicitud operativa",
        id,
      );
    }

    return solicitudActualizada;
  }

  /**
   * Centraliza las reglas utilizadas tanto por POST como por PUT,
   * evitando duplicar las mismas validaciones.
   */
  private validarDatosCompletos(
    datos: CrearSolicitudInput | ActualizarSolicitudInput,
  ): void {
    this.validarTexto(
      "titulo",
      datos.titulo,
    );

    this.validarTexto(
      "area_solicitante",
      datos.area_solicitante,
    );

    this.validarPrioridad(
      datos.prioridad,
    );

    this.validarCostoEstimado(
      datos.costo_estimado,
    );

    this.validarEstado(
      datos.estado,
    );
  }

  /**
   * Los identificadores deben ser enteros positivos.
   */
  private validarId(id: unknown): asserts id is number {
    if (
      typeof id !== "number" ||
      !Number.isInteger(id) ||
      id <= 0
    ) {
      throw new ValidationError(
        "El id debe ser un número entero mayor que cero.",
      );
    }
  }

  /**
   * Verifica que los campos textuales sean cadenas no vacías.
   *
   * trim evita aceptar valores formados únicamente por espacios.
   */
  private validarTexto(
    nombreCampo: string,
    valor: unknown,
  ): asserts valor is string {
    if (
      typeof valor !== "string" ||
      valor.trim().length === 0
    ) {
      throw new ValidationError(
        `El campo ${nombreCampo} es obligatorio y no puede estar vacío.`,
      );
    }
  }

  /**
   * La prioridad debe ser un entero entre 1 y 5.
   *
   * Number.isInteger evita aceptar valores decimales como 2.5.
   */
  private validarPrioridad(
    prioridad: unknown,
  ): asserts prioridad is number {
    if (
      typeof prioridad !== "number" ||
      !Number.isInteger(prioridad) ||
      prioridad < 1 ||
      prioridad > 5
    ) {
      throw new ValidationError(
        "La prioridad debe ser un número entero entre 1 y 5.",
      );
    }
  }

  /**
   * El costo debe ser un número finito y no negativo.
   *
   * Number.isFinite evita aceptar valores especiales como NaN
   * o Infinity.
   */
  private validarCostoEstimado(
    costoEstimado: unknown,
  ): asserts costoEstimado is number {
    if (
      typeof costoEstimado !== "number" ||
      !Number.isFinite(costoEstimado) ||
      costoEstimado < 0
    ) {
      throw new ValidationError(
        "El costo estimado debe ser un número mayor o igual a 0.",
      );
    }
  }

  /**
   * Restringe el estado a los únicos valores permitidos
   * por las reglas del sistema.
   */
  private validarEstado(
    estado: unknown,
  ): asserts estado is EstadoSolicitud {
    if (
      typeof estado !== "string" ||
      !this.estadosValidos.has(
        estado as EstadoSolicitud,
      )
    ) {
      throw new ValidationError(
        "El estado debe ser registrada, en_proceso o finalizada.",
      );
    }
  }
}