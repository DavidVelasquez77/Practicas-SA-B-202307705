import os


def required_env(name: str) -> str:
    value = os.getenv(name)

    if not value:
        raise RuntimeError(
            f"La variable de entorno {name} es obligatoria."
        )

    return value


DATABASE_URL = required_env(
    "DATABASE_URL"
)

PORT = int(
    os.getenv(
        "PORT",
        "8002",
    )
)

RABBITMQ_HOST = required_env(
    "RABBITMQ_HOST"
)

RABBITMQ_PORT = int(
    os.getenv(
        "RABBITMQ_PORT",
        "5672",
    )
)

RABBITMQ_USER = required_env(
    "RABBITMQ_USER"
)

RABBITMQ_PASSWORD = required_env(
    "RABBITMQ_PASSWORD"
)

RABBITMQ_EXCHANGE = os.getenv(
    "RABBITMQ_EXCHANGE",
    "comicrent.events",
)

RABBITMQ_RETURN_QUEUE = os.getenv(
    "RABBITMQ_RETURN_QUEUE",
    "copies.return.requested",
)

RABBITMQ_RETURN_ROUTING_KEY = os.getenv(
    "RABBITMQ_RETURN_ROUTING_KEY",
    "copy.return.requested",
)