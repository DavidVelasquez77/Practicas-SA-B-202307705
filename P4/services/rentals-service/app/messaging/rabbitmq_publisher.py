import json

import aio_pika

from app.config import (
    RABBITMQ_EXCHANGE,
    RABBITMQ_HOST,
    RABBITMQ_PASSWORD,
    RABBITMQ_PORT,
    RABBITMQ_RETURN_ROUTING_KEY,
    RABBITMQ_USER,
)


async def publish_copy_return_requested(
    payload: dict,
) -> None:
    connection = await aio_pika.connect_robust(
        host=RABBITMQ_HOST,
        port=RABBITMQ_PORT,
        login=RABBITMQ_USER,
        password=RABBITMQ_PASSWORD,
    )

    async with connection:
        channel = await connection.channel()

        exchange = await channel.declare_exchange(
            RABBITMQ_EXCHANGE,
            aio_pika.ExchangeType.TOPIC,
            durable=True,
        )

        message = aio_pika.Message(
            body=json.dumps(payload).encode(),
            delivery_mode=(
                aio_pika.DeliveryMode.PERSISTENT
            ),
            content_type="application/json",
        )

        await exchange.publish(
            message,
            routing_key=RABBITMQ_RETURN_ROUTING_KEY,
        )