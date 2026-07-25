import {
  Pool,
  QueryResult,
  QueryResultRow,
} from "pg";

import {
  ActualizarEstadoSolicitudInput,
  ActualizarSolicitudInput,
  CrearSolicitudInput,
  EstadoSolicitud,
  Solicitud,
} from "../models/solicitud.interface";

import { DatabaseOperationError } from "../errors/database-operation.error";

/**
 * Representación exacta de una fila devuelta por PostgreSQL.
 *
 * El driver pg devuelve las columnas NUMERIC como string para evitar
 * pérdidas silenciosas de precisión. Posteriormente se transforma
 * costo_estimado a number mediante el método mapRowToSolicitud.
 */
interface SolicitudRow extends QueryResultRow {
  id: number;
  titulo: string;
  area_solicitante: string;
  prioridad: number;
  costo_estimado: string;
  estado: EstadoSolicitud;
}

/**
 * Parámetros permitidos en las consultas actuales.
 *
 * Todos los valores enviados por el usuario se transmiten por separado
 * de la sentencia SQL para prevenir inyección SQL.
 */
type SqlParameter = string | number;

export class SolicitudRepository {
  /**
   * La instancia de Pool se recibe por constructor.
   *
   * Esto aplica inyección de dependencias: el repositorio no conoce
   * cómo fue creada o configurada la conexión y puede recibir otro
   * Pool durante pruebas.
   */
  constructor(private readonly pool: Pool) {}

  /**
   * Obtiene todas las solicitudes operativas.
   */
  public async obtenerTodas(): Promise<Solicitud[]> {
    const consulta = `
      SELECT
        id,
        titulo,
        area_solicitante,
        prioridad,
        costo_estimado,
        estado
      FROM solicitudes_operativas
      ORDER BY id ASC;
    `;

    const resultado = await this.ejecutarConsulta<SolicitudRow>(
      consulta,
      [],
      "obtener todas las solicitudes",
    );

    return resultado.rows.map((fila) =>
      this.mapRowToSolicitud(fila),
    );
  }

  /**
   * Registra una nueva solicitud operativa.
   *
   * Los valores se envían mediante $1, $2, etc. y nunca se concatenan
   * dentro del SQL, evitando que un texto ingresado por el usuario
   * pueda modificar la consulta.
   */
  public async registrarNueva(
    datos: CrearSolicitudInput,
  ): Promise<Solicitud> {
    const consulta = `
      INSERT INTO solicitudes_operativas (
        titulo,
        area_solicitante,
        prioridad,
        costo_estimado,
        estado
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING
        id,
        titulo,
        area_solicitante,
        prioridad,
        costo_estimado,
        estado;
    `;

    const parametros: SqlParameter[] = [
      datos.titulo,
      datos.area_solicitante,
      datos.prioridad,
      datos.costo_estimado,
      datos.estado,
    ];

    const resultado = await this.ejecutarConsulta<SolicitudRow>(
      consulta,
      parametros,
      "registrar una solicitud",
    );

    return this.mapRowToSolicitud(resultado.rows[0]);
  }

  /**
   * Actualiza completamente una solicitud.
   *
   * Retorna null cuando el id no existe. De esta manera, la capa de
   * servicios puede transformar el resultado en un NotFoundError.
   */
  public async actualizarCompleta(
    id: number,
    datos: ActualizarSolicitudInput,
  ): Promise<Solicitud | null> {
    const consulta = `
      UPDATE solicitudes_operativas
      SET
        titulo = $1,
        area_solicitante = $2,
        prioridad = $3,
        costo_estimado = $4,
        estado = $5
      WHERE id = $6
      RETURNING
        id,
        titulo,
        area_solicitante,
        prioridad,
        costo_estimado,
        estado;
    `;

    const parametros: SqlParameter[] = [
      datos.titulo,
      datos.area_solicitante,
      datos.prioridad,
      datos.costo_estimado,
      datos.estado,
      id,
    ];

    const resultado = await this.ejecutarConsulta<SolicitudRow>(
      consulta,
      parametros,
      "actualizar completamente una solicitud",
    );

    if (resultado.rowCount === 0) {
      return null;
    }

    return this.mapRowToSolicitud(resultado.rows[0]);
  }

  /**
   * Elimina una solicitud por su identificador.
   *
   * Retorna false cuando el registro no existe y true cuando fue
   * eliminado. Esto permite distinguir un 404 de un error de base
   * de datos.
   */
  public async eliminar(id: number): Promise<boolean> {
    const consulta = `
      DELETE FROM solicitudes_operativas
      WHERE id = $1
      RETURNING id;
    `;

    const resultado = await this.ejecutarConsulta<QueryResultRow>(
      consulta,
      [id],
      "eliminar una solicitud",
    );

    return resultado.rowCount !== 0;
  }

  /**
   * Actualiza exclusivamente la columna estado.
   *
   * La columna está escrita directamente en la consulta y no proviene
   * de parámetros del usuario. Esto evita actualizaciones arbitrarias
   * de columnas o la construcción insegura de SQL dinámico.
   */
  public async actualizarEstado(
    id: number,
    datos: ActualizarEstadoSolicitudInput,
  ): Promise<Solicitud | null> {
    const consulta = `
      UPDATE solicitudes_operativas
      SET estado = $1
      WHERE id = $2
      RETURNING
        id,
        titulo,
        area_solicitante,
        prioridad,
        costo_estimado,
        estado;
    `;

    const parametros: SqlParameter[] = [
      datos.estado,
      id,
    ];

    const resultado = await this.ejecutarConsulta<SolicitudRow>(
      consulta,
      parametros,
      "actualizar el estado de una solicitud",
    );

    if (resultado.rowCount === 0) {
      return null;
    }

    return this.mapRowToSolicitud(resultado.rows[0]);
  }

  /**
   * Centraliza la ejecución y el manejo de errores de PostgreSQL.
   *
   * Así se evita repetir bloques try/catch en cada método. La clase
   * sigue encargándose exclusivamente del acceso a datos.
   */
  private async ejecutarConsulta<T extends QueryResultRow>(
    consulta: string,
    parametros: SqlParameter[],
    nombreOperacion: string,
  ): Promise<QueryResult<T>> {
    try {
      return await this.pool.query<T>(
        consulta,
        parametros,
      );
    } catch (error: unknown) {
      throw new DatabaseOperationError(
        nombreOperacion,
        error,
      );
    }
  }

  /**
   * Convierte la estructura específica de pg a la estructura
   * utilizada por la aplicación.
   */
  private mapRowToSolicitud(
    fila: SolicitudRow,
  ): Solicitud {
    return {
      id: fila.id,
      titulo: fila.titulo,
      area_solicitante: fila.area_solicitante,
      prioridad: fila.prioridad,
      costo_estimado: Number(fila.costo_estimado),
      estado: fila.estado,
    };
  }
}