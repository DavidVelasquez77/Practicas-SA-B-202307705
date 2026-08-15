from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database import init_db

# Import obligatorio para registrar
# el modelo antes de create_all.
from app.models.comic_copy import (
    ComicCopyModel,
)

from app.routers.copies_router import (
    router as copies_router,
)


@asynccontextmanager
async def lifespan(
    app: FastAPI,
):
    await init_db()

    yield


app = FastAPI(
    title="Copies Service",
    description=(
        "Microservicio encargado de "
        "administrar ejemplares físicos "
        "de los comics."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


app.include_router(
    copies_router
)


@app.get("/health")
async def health():
    return {
        "service": "copies-service",
        "status": "ok",
    }