import asyncio
import json
from datetime import datetime, timezone

import aio_pika
from sqlalchemy import select

from app.config import (
    RABBITMQ_EXCHANGE,
    RABBITMQ_HOST,
    RABBITMQ_PASSWORD,
    RABBITMQ_PORT,
    RABBITMQ_RETURN_QUEUE,
    RABBITMQ_RETURN_ROUTING_KEY,
    RABBITMQ_USER,
)
from app.database import (
    SessionLocal,
    init_db,
)
from app.models.comic_copy import (
    ComicCopyModel,
)
from app.models.processed_event import (
    ProcessedEventModel,
)


async def process_message(
    message: aio_pika.IncomingMessage,
) -> None:
    try:
        payload = json.loads(
            message.body.decode("utf-8")
        )

        event_id = payload["eventId"]
        rental_id = payload["rentalId"]
        copy_id = payload["copyId"]

        print(
            "[Copies Consumer] "
            f"Evento recibido: {event_id} "
            f"rentalId={rental_id} "
            f"copyId={copy_id}"
        )

    except (
        json.JSONDecodeError,
        KeyError,
        TypeError,
    ) as exc:
        print(
            "[Copies Consumer] "
            f"Mensaje inválido: {exc}"
        )

        await message.reject(
            requeue=False
        )
        return

    async with SessionLocal() as session:
        try:
            # ======================================
            # IDEMPOTENCIA
            # ======================================

            result = await session.execute(
                select(
                    ProcessedEventModel
                ).where(
                    ProcessedEventModel.event_id
                    == event_id
                )
            )

            processed_event = (
                result.scalars().first()
            )

            if processed_event is not None:
                print(
                    "[Copies Consumer] "
                    f"Evento {event_id} "
                    "ya fue procesado."
                )

                await message.ack()
                return

            # ======================================
            # BUSCAR COPY
            # ======================================

            copy = await session.get(
                ComicCopyModel,
                copy_id,
            )

            if copy is None:
                print(
                    "[Copies Consumer] "
                    f"Copy {copy_id} no existe."
                )

                await session.rollback()

                await message.reject(
                    requeue=False
                )
                return

            # ======================================
            # CAMBIAR ESTADO
            # ======================================

            if copy.estado != "ALQUILADO":
                print(
                    "[Copies Consumer] "
                    f"Copy {copy_id} tiene estado "
                    f"{copy.estado}; "
                    "no se modificará."
                )

                await session.rollback()

                await message.reject(
                    requeue=False
                )
                return

            copy.estado = "DISPONIBLE"

            # ======================================
            # REGISTRAR EVENTO PROCESADO
            # ======================================

            processed_event = (
                ProcessedEventModel(
                    event_id=event_id,
                    processed_at=datetime.now(
                        timezone.utc
                    ),
                )
            )

            session.add(
                processed_event
            )

            # ======================================
            # COMMIT PRIMERO
            # ======================================

            await session.commit()

            print(
                "[Copies Consumer] "
                f"Copy {copy_id} -> DISPONIBLE"
            )

            print(
                "[Copies Consumer] "
                f"Evento {event_id} procesado."
            )

            # ======================================
            # ACK DESPUÉS DEL COMMIT
            # ======================================

            await message.ack()

        except Exception as exc:
            await session.rollback()

            print(
                "[Copies Consumer] "
                f"Error procesando evento "
                f"{event_id}: {exc}"
            )

            if not message.processed:
                await message.nack(
                    requeue=True
                )


async def main() -> None:
    # Asegura que processed_events exista
    await init_db()

    connection = (
        await aio_pika.connect_robust(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            login=RABBITMQ_USER,
            password=RABBITMQ_PASSWORD,
        )
    )

    channel = await connection.channel()

    # Solo entrega un mensaje a la vez
    await channel.set_qos(
        prefetch_count=1
    )

    exchange = (
        await channel.declare_exchange(
            RABBITMQ_EXCHANGE,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )
    )

    queue = await channel.declare_queue(
        RABBITMQ_RETURN_QUEUE,
        durable=True,
    )

    await queue.bind(
        exchange,
        routing_key=(
            RABBITMQ_RETURN_ROUTING_KEY
        ),
    )

    print(
        "[Copies Consumer] "
        "Conectado a RabbitMQ."
    )

    print(
        "[Copies Consumer] "
        f"Exchange: {RABBITMQ_EXCHANGE}"
    )

    print(
        "[Copies Consumer] "
        f"Queue: {RABBITMQ_RETURN_QUEUE}"
    )

    print(
        "[Copies Consumer] "
        "Esperando eventos..."
    )

    await queue.consume(
        process_message
    )

    try:
        await asyncio.Future()
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(
        main()
    )