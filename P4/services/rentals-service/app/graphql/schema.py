import strawberry
from graphql import GraphQLError

from app.graphql.inputs import (
    CreateRentalInput,
)
from app.graphql.types import Rental
from app.services.rentals_service import (
    RentalsService,
)
from app.observability import log_graphql_error


@strawberry.type
class Query:

    @strawberry.field
    async def rentals(
        self,
    ) -> list[Rental]:
        return await RentalsService.find_all()

    @strawberry.field
    async def rental(
        self,
        id: int,
    ) -> Rental | None:
        return await RentalsService.find_one(
            id
        )

    @strawberry.field
    async def rentals_by_user(
        self,
        user_id: int,
    ) -> list[Rental]:
        return (
            await RentalsService.find_by_user(
                user_id
            )
        )


@strawberry.type
class Mutation:

    @strawberry.mutation
    async def create_rental(
        self,
        input: CreateRentalInput,
    ) -> Rental:
        try:
            return await RentalsService.create(input)
        except GraphQLError as exc:
            log_graphql_error("graphql.rental.create.failed", exc)
            raise

    @strawberry.mutation
    async def return_rental(
        self,
        id: int,
    ) -> Rental:
        try:
            return await RentalsService.return_rental(id)
        except GraphQLError as exc:
            log_graphql_error("graphql.rental.return.failed", exc)
            raise


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
)
