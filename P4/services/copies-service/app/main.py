from contextlib import asynccontextmanager

from app.observability import (
    instrument_fastapi,
    shutdown_tracing,
    start_metrics_server,
)
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

from app.models.processed_event import (
    ProcessedEventModel,
)

@asynccontextmanager
async def lifespan(
    app: FastAPI,
):
    await init_db()
    metrics_server, metrics_thread = start_metrics_server()

    try:
        yield
    finally:
        metrics_server.shutdown()
        metrics_server.server_close()
        metrics_thread.join(timeout=2)
        shutdown_tracing()


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

instrument_fastapi(app)


app.include_router(
    copies_router
)


@app.get("/health")
async def health():
    return {
        "service": "copies-service",
        "status": "ok",
    }
