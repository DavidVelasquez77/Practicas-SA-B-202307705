
# 6. Diagramas de secuencia UML para los flujos críticos

Los siguientes diagramas representan los tres flujos críticos solicitados:

1. aprobación de transacciones mediante Maker-Checker-Authorizer;
2. envío de transacciones aprobadas al Core Bancario;
3. notificación a clientes o beneficiarios.

El identificador de trazabilidad (`Correlation ID`) se propaga en las solicitudes y en los eventos internos. Para mantener los diagramas legibles, no se muestra como parámetro en cada mensaje, pero forma parte del contexto de cada operación.

---

## 6.1 Secuencia UML — Aprobación de transacciones de tres pasos

El proceso de aprobación debe cumplir el esquema:

```text
Maker
  ↓
Checker
  ↓
Authorizer
````

Cada etapa debe ser realizada por un usuario distinto.

Si el Checker o el Authorizer rechazan el lote, el resultado debe comunicarse al Servicio de Lotes para actualizar su estado e historial.

```mermaid
sequenceDiagram
    autonumber

    actor M as Maker
    actor C as Checker
    actor A as Authorizer

    participant FE as Aplicación Cliente
    participant GW as API Gateway
    participant AS as Servicio de Aprobaciones
    participant ADB as BD de Aprobaciones
    participant BUS as Bus de Eventos
    participant BS as Servicio de Lotes
    participant BDB as BD de Lotes
    participant LOG as Logging Centralizado

    Note over GW,LOG: El Correlation ID se propaga durante toda la operación

    M->>FE: Enviar lote al flujo de aprobación
    FE->>GW: Solicitud autenticada
    GW->>AS: Acción Maker

    AS->>ADB: Consultar proceso de aprobación
    AS->>ADB: Registrar acción Maker
    AS->>LOG: Registrar acción Maker

    C->>FE: Revisar lote
    FE->>GW: Solicitud autenticada
    GW->>AS: Acción Checker

    AS->>ADB: Consultar participantes anteriores
    AS->>AS: Validar Checker != Maker

    alt Checker rechaza
        AS->>ADB: Registrar decisión REJECTED
        AS->>ADB: Estado del proceso = REJECTED
        AS->>BUS: Publicar evento Lote rechazado
        AS->>LOG: Registrar rechazo

        BUS->>BS: Evento Lote rechazado
        BS->>BDB: Estado del lote = REJECTED

    else Checker aprueba
        AS->>ADB: Registrar decisión APPROVED
        AS->>LOG: Registrar aprobación Checker

        A->>FE: Autorizar lote
        FE->>GW: Solicitud autenticada
        GW->>AS: Acción Authorizer

        AS->>ADB: Consultar participantes anteriores
        AS->>AS: Validar Authorizer != Maker y Checker

        alt Authorizer rechaza
            AS->>ADB: Registrar decisión REJECTED
            AS->>ADB: Estado del proceso = REJECTED
            AS->>BUS: Publicar evento Lote rechazado
            AS->>LOG: Registrar rechazo

            BUS->>BS: Evento Lote rechazado
            BS->>BDB: Estado del lote = REJECTED

        else Authorizer aprueba
            AS->>ADB: Registrar decisión APPROVED
            AS->>ADB: currentStep = COMPLETED
            AS->>ADB: Estado del proceso = APPROVED

            AS->>BUS: Publicar evento Lote aprobado
            AS->>LOG: Registrar aprobación final

            BUS->>BS: Evento Lote aprobado
            BS->>BDB: Estado del lote = APPROVED
        end
    end
```

### Resultado del flujo

Un lote únicamente se considera aprobado cuando:

```text
Maker registrado
        +
Checker aprobado
        +
Authorizer aprobado
```

Además:

```text
Maker != Checker
Maker != Authorizer
Checker != Authorizer
```

Si Checker o Authorizer rechazan el lote, se genera el evento:

```text
Lote rechazado
```

que permite actualizar el historial administrado por el Servicio de Lotes.

---

## 6.2 Secuencia UML — Envío al Core Bancario

El Servicio de Procesamiento comienza su trabajo al recibir el evento:

```text
Lote aprobado
```

Antes de enviar las transacciones al Core Bancario se verifica si el lote ya fue procesado anteriormente.

Esta validación evita que un evento duplicado provoque el envío del mismo lote más de una vez.

```mermaid
sequenceDiagram
    autonumber

    participant BUS as Bus de Eventos
    participant PS as Servicio de Procesamiento
    participant PDB as BD de Procesamiento
    participant CORE as Core Bancario Externo
    participant BS as Servicio de Lotes
    participant BDB as BD de Lotes
    participant LOG as Logging Centralizado

    Note over BUS,LOG: El evento conserva el Correlation ID en sus metadatos

    BUS->>PS: Evento Lote aprobado

    PS->>PDB: Buscar procesamiento por batchId

    alt Lote ya procesado
        PDB-->>PS: ProcessingJob en estado terminal
        PS->>LOG: Registrar evento duplicado ignorado

    else Lote no procesado
        PDB-->>PS: No existe procesamiento terminal

        PS->>PDB: Crear ProcessingJob
        PS->>PDB: Estado = PROCESSING

        loop Hasta alcanzar el máximo de intentos
            PS->>PDB: Registrar ProcessingAttempt
            PS->>CORE: Enviar transacciones aprobadas

            alt Core acepta el lote
                CORE-->>PS: Respuesta exitosa

                PS->>PDB: Intento = SUCCESS
                PS->>PDB: Estado = COMPLETED
                PS->>BUS: Publicar Lote procesado
                PS->>LOG: Registrar procesamiento exitoso

            else Core rechaza funcionalmente el lote
                CORE-->>PS: Respuesta de rechazo

                PS->>PDB: Registrar respuesta del Core
                PS->>PDB: Estado = REJECTED
                PS->>BUS: Publicar Lote fallido
                PS->>LOG: Registrar rechazo del Core

            else Error técnico temporal
                CORE-->>PS: Timeout / indisponibilidad temporal

                PS->>PDB: Registrar intento fallido

                alt Aún existen intentos disponibles
                    PS->>PDB: Estado = RETRY_PENDING
                    PS->>LOG: Registrar reintento pendiente
                    Note over PS,CORE: El siguiente intento se realiza según la política de reintentos

                else Máximo de intentos alcanzado
                    PS->>PDB: Estado = FAILED
                    PS->>BUS: Publicar Lote fallido
                    PS->>LOG: Registrar fallo definitivo
                end
            end
        end
    end

    BUS->>BS: Evento Lote procesado / Lote fallido

    alt Lote procesado
        BS->>BDB: Estado del lote = PROCESSED
    else Lote fallido
        BS->>BDB: Estado del lote = FAILED
    end
```

### Idempotencia

El atributo:

```text
PROCESSING_JOB.batch_id
```

es único dentro del Servicio de Procesamiento.

Esto permite verificar si el lote ya fue procesado antes de volver a enviarlo al Core Bancario.

La estrategia evita situaciones como:

```text
Evento Lote aprobado
        ↓
enviado dos veces por el Bus
        ↓
Core recibe el mismo lote dos veces
```

---

## 6.3 Secuencia UML — Notificación a clientes o beneficiarios

El Servicio de Notificaciones comienza su operación al recibir el evento:

```text
Lote aprobado
```

El envío de correos se realiza de forma independiente al procesamiento bancario.

De esta manera, un problema temporal en el servicio de correo no bloquea la aprobación ni el envío del lote al Core Bancario.

```mermaid
sequenceDiagram
    autonumber

    participant BUS as Bus de Eventos
    participant NS as Servicio de Notificaciones
    participant NDB as BD de Notificaciones
    participant MAIL as Servicio Externo de Correo
    participant LOG as Logging Centralizado

    Note over BUS,LOG: El evento conserva el Correlation ID en sus metadatos

    BUS->>NS: Evento Lote aprobado

    NS->>NDB: Crear Notification
    NS->>NDB: Registrar destinatarios
    NS->>NDB: Estado = PROCESSING

    Note over NS,NDB: Los destinatarios corresponden al snapshot asociado al lote aprobado

    loop Por cada beneficiario
        NS->>NDB: Consultar estado del destinatario

        alt Destinatario ya notificado
            NDB-->>NS: Estado = SENT
            NS->>LOG: Ignorar envío duplicado

        else Destinatario pendiente
            loop Hasta alcanzar el máximo de intentos
                NS->>NDB: Registrar NotificationAttempt
                NS->>MAIL: Enviar correo

                alt Envío exitoso
                    MAIL-->>NS: Confirmación

                    NS->>NDB: Intento = SUCCESS
                    NS->>NDB: Destinatario = SENT
                    NS->>LOG: Registrar envío exitoso

                else Error temporal
                    MAIL-->>NS: Error temporal

                    NS->>NDB: Registrar intento fallido

                    alt Existen intentos disponibles
                        NS->>NDB: Destinatario = RETRY_PENDING
                        NS->>LOG: Registrar reintento pendiente
                        Note over NS,MAIL: El reintento se ejecuta según la política definida

                    else Máximo de intentos alcanzado
                        NS->>NDB: Destinatario = FAILED
                        NS->>LOG: Registrar fallo definitivo
                    end
                end
            end
        end
    end

    NS->>NDB: Calcular estado global de Notification

    alt Todos enviados
        NS->>NDB: Estado = SENT
    else Algunos enviados y algunos fallidos
        NS->>NDB: Estado = PARTIAL
    else Todos fallaron
        NS->>NDB: Estado = FAILED
    end
```

### Estados finales

El estado general de una notificación puede ser:

```text
PENDING
PROCESSING
SENT
PARTIAL
FAILED
```

Mientras que cada destinatario puede encontrarse en:

```text
PENDING
SENT
RETRY_PENDING
FAILED
```

Esto permite representar correctamente un lote con múltiples beneficiarios.

Por ejemplo:

```text
100 beneficiarios

98 enviados correctamente
2 fallidos

Estado general:
PARTIAL
```

---

## 6.4 Coherencia entre los tres diagramas

Los tres flujos se relacionan mediante eventos del negocio.

```text
Maker
  ↓
Checker
  ↓
Authorizer
  ↓
Lote aprobado
  ↓
Bus de Eventos
  ├──────────────→ Servicio de Procesamiento
  │                       ↓
  │                 Core Bancario
  │
  └──────────────→ Servicio de Notificaciones
                          ↓
                   Servicio de Correo
```

El Servicio de Lotes también recibe los cambios relevantes para mantener actualizado el historial:

```text
Lote rechazado
      ↓
REJECTED

Lote aprobado
      ↓
APPROVED

Lote procesado
      ↓
PROCESSED

Lote fallido
      ↓
FAILED
```

De esta manera, los diagramas de secuencia mantienen consistencia con el Diagrama de Arquitectura General y con los estados definidos en los modelos ER.

```

Un detalle: en **6.2**, cuando lo pases a Lucidchart, yo simplificaría visualmente el `loop` de reintentos si queda demasiado cargado. Lo importante es que aparezcan claramente **idempotencia → envío al Core → éxito/rechazo/error temporal → reintento → resultado final → actualización de Lotes**. Esa es la lógica que debemos conservar.
```
