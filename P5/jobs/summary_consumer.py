import asyncio
import json
import os

from datetime import datetime

import aio_pika

from db import get_connection, ensure_tables


async def process_message(message: aio_pika.IncomingMessage):
    try:
        payload = json.loads(message.body.decode())

        event_id = payload["eventId"]

        print(
            f"[Summary Consumer] "
            f"Evento recibido: {event_id}"
        )

        with get_connection() as conn:
            with conn.cursor() as cursor:

                cursor.execute(
                    """
                    SELECT 1
                    FROM hourly_summaries
                    WHERE event_id = %s;
                    """,
                    (event_id,)
                )

                if cursor.fetchone():
                    print(
                        f"[Summary Consumer] "
                        f"Evento duplicado: {event_id}"
                    )

                    await message.ack()
                    return

                cursor.execute(
                    """
                    INSERT INTO hourly_summaries (
                        event_id,
                        carnet,
                        hour_start,
                        hour_end,
                        total_ticks,
                        generated_at
                    )
                    VALUES (
                        %s,
                        %s,
                        %s,
                        %s,
                        %s,
                        %s
                    );
                    """,
                    (
                        event_id,
                        payload["carnet"],
                        datetime.fromisoformat(
                            payload["hourStart"]
                        ),
                        datetime.fromisoformat(
                            payload["hourEnd"]
                        ),
                        payload["totalTicks"],
                        datetime.fromisoformat(
                            payload["generatedAt"]
                        ),
                    )
                )

            conn.commit()

        await message.ack()

        print(
            f"[Summary Consumer] "
            f"Evento {event_id} almacenado y ACK"
        )

    except Exception as exc:
        print(
            f"[Summary Consumer] ERROR: {exc}"
        )

        await message.nack(
            requeue=True
        )


async def main():
    ensure_tables()

    rabbit_user = os.environ["RABBITMQ_USER"]
    rabbit_password = os.environ["RABBITMQ_PASSWORD"]
    rabbit_host = os.environ["RABBITMQ_HOST"]
    rabbit_port = int(
        os.getenv("RABBITMQ_PORT", "5672")
    )

    exchange_name = os.getenv(
        "RABBITMQ_EXCHANGE",
        "comicrent.events"
    )

    queue_name = os.getenv(
        "SUMMARY_QUEUE",
        "operations.hourly.summary"
    )

    routing_key = os.getenv(
        "SUMMARY_ROUTING_KEY",
        "operations.hourly.summary"
    )

    connection = await aio_pika.connect_robust(
        host=rabbit_host,
        port=rabbit_port,
        login=rabbit_user,
        password=rabbit_password,
    )

    channel = await connection.channel()

    await channel.set_qos(
        prefetch_count=1
    )

    exchange = await channel.declare_exchange(
        exchange_name,
        aio_pika.ExchangeType.TOPIC,
        durable=True,
    )

    queue = await channel.declare_queue(
        queue_name,
        durable=True,
    )

    await queue.bind(
        exchange,
        routing_key=routing_key,
    )

    await queue.consume(
        process_message
    )

    print(
        "[Summary Consumer] Conectado a RabbitMQ."
    )

    print(
        f"[Summary Consumer] Queue: {queue_name}"
    )

    print(
        "[Summary Consumer] Esperando resúmenes..."
    )

    try:
        await asyncio.Future()
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())