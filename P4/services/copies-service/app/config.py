import os


DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise RuntimeError(
        "La variable de entorno DATABASE_URL es obligatoria."
    )


PORT = int(
    os.getenv("PORT", "8002")
)