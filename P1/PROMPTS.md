Prompt 1: Generación del Repositorio y Consultas SQL Seguras

  <rol>
    Actúa como un desarrollador experto en backend utilizando TypeScript, Node.js y principios SOLID.
  </rol>

  <contexto>
    Estoy construyendo una API REST y necesito implementar la capa de acceso a datos (Repositorio) 
    utilizando el driver nativo pg para PostgreSQL, sin ningún ORM.

    El objetivo es gestionar una tabla llamada solicitudes_operativas con los siguientes atributos:
    - id (identificador único, tipo serial o UUID)
    - titulo (string)
    - area_solicitante (string)
    - prioridad (entero del 1 al 5)
    - costo_estimado (decimal)
    - estado (string: registrada, en_proceso, finalizada)
  </contexto>

  <tarea>
    Genera el código para una clase llamada SolicitudRepository que contenga los 5 métodos 
    necesarios para los endpoints CRUD: obtener todas, registrar nueva, actualizar completa, 
    eliminar, y actualizar exclusivamente el estado.
  </tarea>

  <instrucciones>
    <seguridad>
      - Es obligatorio prevenir la inyección SQL utilizando consultas parametrizadas de la 
        librería pg (ej. $1, $2).
      - El método de actualización de estado (PATCH) no debe construir la consulta mediante 
        concatenación de strings ni permitir campos dinámicos sin validar; debe limitarse 
        estrictamente a actualizar la columna estado mediante parámetro.
      - Implementa un manejo de errores robusto que distinga entre:
        a) Registro no encontrado (id inexistente en update/delete), para poder devolver 404.
        b) Errores reales de conexión o ejecución de la consulta, para devolver 500.
    </seguridad>

    <codigo_limpio>
      - Aplica el Principio de Responsabilidad Única (SRP): la clase solo debe encargarse del 
        acceso a datos, sin lógica de negocio.
      - Utiliza nombres de variables y métodos explícitos y descriptivos.
      - No dupliques lógica de conexión en cada método.
    </codigo_limpio>

    <inversion_de_dependencias>
      - El SolicitudRepository debe recibir la instancia de Pool de pg por constructor 
        (inyección de dependencias), en lugar de crear la conexión internamente, para evitar 
        acoplamiento directo con la configuración de la base de datos (Principio DIP).
    </inversion_de_dependencias>

    <tipado>
      - Genera las interfaces de TypeScript correspondientes para los datos de entrada y salida 
        de cada método.
    </tipado>

    <documentacion_interna>
      - Agrega comentarios breves explicando por qué cada decisión de seguridad (parametrización, 
        separación de responsabilidades, inyección de dependencias) previene un riesgo o mejora 
        la mantenibilidad del código.
    </documentacion_interna>
  </instrucciones>