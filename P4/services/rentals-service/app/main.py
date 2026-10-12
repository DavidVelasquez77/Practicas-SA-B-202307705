from contextlib import (
    asynccontextmanager,
)

from app.observability import (
    instrument_fastapi,
    shutdown_tracing,
    start_metrics_server,
)
from fastapi import FastAPI
from strawberry.fastapi import (
    GraphQLRouter,
)

from app.clients.http_client import (
    close_http_client,
)
from app.database import (
    init_db,
)
from app.graphql.schema import schema

from app.models.rental import (
    RentalModel,
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
        await close_http_client()
        shutdown_tracing()


app = FastAPI(
    title="Rentals Service",
    description=(
        "Microservicio encargado de "
        "gestionar alquileres de comics."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

instrument_fastapi(app)


graphql_app = GraphQLRouter(
    schema,
)


app.include_router(
    graphql_app,
    prefix="/graphql",
)


@app.get("/health")
async def health():
    return {
        "service": "rentals-service",
        "status": "ok",
    }
