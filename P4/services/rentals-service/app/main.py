from contextlib import (
    asynccontextmanager,
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

    try:
        yield

    finally:
        await close_http_client()


app = FastAPI(
    title="Rentals Service",
    description=(
        "Microservicio encargado de "
        "gestionar alquileres de comics."
    ),
    version="1.0.0",
    lifespan=lifespan,
)


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