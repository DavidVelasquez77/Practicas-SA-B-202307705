import strawberry

from app.graphql.inputs import (
    CreateRentalInput,
)
from app.graphql.types import Rental
from app.services.rentals_service import (
    RentalsService,
)


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
        return await RentalsService.create(
            input
        )

    @strawberry.mutation
    async def return_rental(
        self,
        id: int,
    ) -> Rental:
        return (
            await RentalsService.return_rental(
                id
            )
        )


schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
)