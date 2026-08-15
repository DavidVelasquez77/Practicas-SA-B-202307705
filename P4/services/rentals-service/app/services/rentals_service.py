from datetime import (
    datetime,
    timedelta,
    timezone,
)
from decimal import Decimal

from graphql import GraphQLError
from sqlalchemy import select

from app.database import SessionLocal
from app.graphql.inputs import (
    CreateRentalInput,
)
from app.graphql.types import Rental
from app.models.rental import RentalModel


def to_graphql(
    rental: RentalModel,
) -> Rental:
    return Rental(
        id=rental.id,
        user_id=rental.user_id,
        comic_id=rental.comic_id,
        copy_id=rental.copy_id,
        fecha_alquiler=rental.fecha_alquiler,
        fecha_limite=rental.fecha_limite,
        fecha_devolucion=rental.fecha_devolucion,
        precio_alquiler=float(
            rental.precio_alquiler
        ),
        estado=rental.estado,
    )


class RentalsService:

    @staticmethod
    async def find_all() -> list[Rental]:
        async with SessionLocal() as session:

            result = await session.execute(
                select(RentalModel).order_by(
                    RentalModel.id.asc()
                )
            )

            rentals = result.scalars().all()

            return [
                to_graphql(rental)
                for rental in rentals
            ]

    @staticmethod
    async def find_one(
        rental_id: int,
    ) -> Rental | None:

        async with SessionLocal() as session:

            rental = await session.get(
                RentalModel,
                rental_id,
            )

            if rental is None:
                return None

            return to_graphql(rental)

    @staticmethod
    async def find_by_user(
        user_id: int,
    ) -> list[Rental]:

        async with SessionLocal() as session:

            result = await session.execute(
                select(RentalModel)
                .where(
                    RentalModel.user_id
                    == user_id
                )
                .order_by(
                    RentalModel.id.asc()
                )
            )

            rentals = result.scalars().all()

            return [
                to_graphql(rental)
                for rental in rentals
            ]

    @staticmethod
    async def create(
        input: CreateRentalInput,
    ) -> Rental:

        if input.precio_alquiler <= 0:
            raise GraphQLError(
                "El precio de alquiler debe "
                "ser mayor que cero."
            )

        if input.dias <= 0:
            raise GraphQLError(
                "Los días de alquiler deben "
                "ser mayores que cero."
            )

        async with SessionLocal() as session:

            active_result = await session.execute(
                select(RentalModel).where(
                    RentalModel.copy_id
                    == input.copy_id,
                    RentalModel.estado
                    == "ACTIVO",
                )
            )

            active_rental = (
                active_result
                .scalars()
                .first()
            )

            if active_rental:
                raise GraphQLError(
                    "El ejemplar ya tiene "
                    "un alquiler activo."
                )

            now = datetime.now(
                timezone.utc
            )

            rental = RentalModel(
                user_id=input.user_id,
                comic_id=input.comic_id,
                copy_id=input.copy_id,
                fecha_alquiler=now,
                fecha_limite=(
                    now
                    + timedelta(
                        days=input.dias
                    )
                ),
                precio_alquiler=Decimal(
                    str(
                        input.precio_alquiler
                    )
                ),
                estado="ACTIVO",
            )

            session.add(rental)

            await session.commit()

            await session.refresh(rental)

            return to_graphql(rental)

    @staticmethod
    async def return_rental(
        rental_id: int,
    ) -> Rental:

        async with SessionLocal() as session:

            rental = await session.get(
                RentalModel,
                rental_id,
            )

            if rental is None:
                raise GraphQLError(
                    "El alquiler no existe."
                )

            if rental.estado != "ACTIVO":
                raise GraphQLError(
                    "El alquiler ya fue "
                    "devuelto."
                )

            rental.estado = "DEVUELTO"

            rental.fecha_devolucion = (
                datetime.now(
                    timezone.utc
                )
            )

            await session.commit()

            await session.refresh(rental)

            return to_graphql(rental)