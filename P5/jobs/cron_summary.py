import asyncio
import json
import os
import uuid

from datetime import datetime, timezone, timedelta

import aio_pika

from db import get_connection, ensure_tables


CARNET = "202307705"
GT_OFFSET = timezone(timedelta(hours=-6))


async def main():
    ensure_tables()

    now_gt = datetime.now(GT_OFFSET)

    hour_start = now_gt.replace(
        minute=0,
        second=0,
        microsecond=0
    )

    hour_end = hour_start + timedelta(hours=1)

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM cron_ticks
                WHERE executed_at >= %s
                  AND executed_at < %s;
                """,
                (
                    hour_start,
                    hour_end,
                )
            )

            total_ticks = cursor.fetchone()[0]

    event_id = str(uuid.uuid4())

    event = {
        "eventId": event_id,
        "type": "operations.hourly.summary",
        "carnet": CARNET,
        "hourStart": hour_start.isoformat(),
        "hourEnd": hour_end.isoformat(),
        "totalTicks": total_ticks,
        "generatedAt": now_gt.isoformat(),
    }

    rabbit_user = os.environ["RABBITMQ_USER"]
    rabbit_password = os.environ["RABBITMQ_PASSWORD"]
    rabbit_host = os.environ["RABBITMQ_HOST"]
    rabbit_port = int(os.getenv("RABBITMQ_PORT", "5672"))

    connection = await aio_pika.connect_robust(
        host=rabbit_host,
        port=rabbit_port,
        login=rabbit_user,
        password=rabbit_password,
    )

    async with connection:
        channel = await connection.channel()

        exchange = await channel.declare_exchange(
            os.getenv(
                "RABBITMQ_EXCHANGE",
                "comicrent.events"
            ),
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )

        message = aio_pika.Message(
            body=json.dumps(event).encode(),
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            message_id=event_id,
        )

        routing_key = os.getenv(
            "SUMMARY_ROUTING_KEY",
            "operations.hourly.summary"
        )

        await exchange.publish(
            message,
            routing_key=routing_key,
        )

    print(
        f"[CronJob Summary] "
        f"eventId={event_id} "
        f"totalTicks={total_ticks} "
        f"publicado"
    )


if __name__ == "__main__":
    asyncio.run(main())