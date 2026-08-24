from datetime import (
    datetime,
    timedelta,
    timezone,
)
from decimal import Decimal

from graphql import GraphQLError
from sqlalchemy import select

from app.clients.comics_client import (
    ComicsClient,
)
from app.clients.copies_client import (
    CopiesClient,
)
from app.clients.errors import (
    RemoteServiceError,
)
from app.database import SessionLocal
from app.graphql.inputs import (
    CreateRentalInput,
)
from app.graphql.types import Rental
from app.models.rental import RentalModel

from uuid import uuid4

from app.messaging.rabbitmq_publisher import (
    publish_copy_return_requested,
)

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
                select(
                    RentalModel
                ).order_by(
                    RentalModel.id.asc()
                )
            )

            rentals = (
                result
                .scalars()
                .all()
            )

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

            return to_graphql(
                rental
            )

    @staticmethod
    async def find_by_user(
        user_id: int,
    ) -> list[Rental]:

        async with SessionLocal() as session:

            result = await session.execute(
                select(
                    RentalModel
                )
                .where(
                    RentalModel.user_id
                    == user_id
                )
                .order_by(
                    RentalModel.id.asc()
                )
            )

            rentals = (
                result
                .scalars()
                .all()
            )

            return [
                to_graphql(rental)
                for rental in rentals
            ]

    @staticmethod
    async def create(
        input: CreateRentalInput,
    ) -> Rental:

        if input.user_id <= 0:
            raise GraphQLError(
                "El userId debe ser "
                "mayor que cero."
            )

        if input.comic_id <= 0:
            raise GraphQLError(
                "El comicId debe ser "
                "mayor que cero."
            )

        if input.dias <= 0:
            raise GraphQLError(
                "Los días de alquiler "
                "deben ser mayores "
                "que cero."
            )

        # ======================================
        # 1. CONSULTAR COMICS SERVICE
        # ======================================

        try:
            comic = await ComicsClient.find_one(
                input.comic_id
            )

        except RemoteServiceError as exc:
            raise GraphQLError(
                str(exc)
            ) from exc

        if not comic["activo"]:
            raise GraphQLError(
                "El comic no se encuentra "
                "disponible para alquiler."
            )

        precio_alquiler = float(
            comic["precioAlquiler"]
        )

        # ======================================
        # 2. CONSULTAR COPIES SERVICE
        # ======================================

        try:
            copy = (
                await CopiesClient.find_available(
                    input.comic_id
                )
            )

        except RemoteServiceError as exc:
            raise GraphQLError(
                str(exc)
            ) from exc

        copy_id = int(
            copy["id"]
        )

        # ======================================
        # 3. VALIDAR RENTAL LOCAL
        # ======================================

        async with SessionLocal() as session:

            active_result = await session.execute(
                select(
                    RentalModel
                ).where(
                    RentalModel.copy_id
                    == copy_id,
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

            # ==================================
            # 4. RESERVAR COPIA
            # ==================================

            try:
                await CopiesClient.mark_as_rented(
                    copy_id
                )

            except RemoteServiceError as exc:
                raise GraphQLError(
                    str(exc)
                ) from exc

            # ==================================
            # 5. CREAR ALQUILER
            # ==================================

            now = datetime.now(
                timezone.utc
            )

            rental = RentalModel(
                user_id=input.user_id,
                comic_id=input.comic_id,
                copy_id=copy_id,
                fecha_alquiler=now,
                fecha_limite=(
                    now
                    + timedelta(
                        days=input.dias
                    )
                ),
                precio_alquiler=Decimal(
                    str(
                        precio_alquiler
                    )
                ),
                estado="ACTIVO",
            )

            session.add(
                rental
            )

            try:
                await session.commit()

                await session.refresh(
                    rental
                )

            except Exception as exc:

                await session.rollback()

                # Compensación:
                # si falló guardar Rental,
                # liberamos nuevamente Copy.

                try:
                    await (
                        CopiesClient
                        .mark_as_available(
                            copy_id
                        )
                    )

                except RemoteServiceError:
                    pass

                raise GraphQLError(
                    "No se pudo registrar "
                    "el alquiler."
                ) from exc

            return to_graphql(
                rental
            )

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
                    "El alquiler ya fue devuelto."
                )

            copy_id = rental.copy_id

            # ==================================
            # 1. ACTUALIZAR RENTAL LOCAL
            # ==================================

            rental.estado = "DEVUELTO"
            rental.fecha_devolucion = (
                datetime.now(
                    timezone.utc
                )
            )

            try:
                await session.commit()
                await session.refresh(
                    rental
                )

            except Exception as exc:
                await session.rollback()

                raise GraphQLError(
                    "No se pudo completar "
                    "la devolución."
                ) from exc

            # ==================================
            # 2. PUBLICAR EVENTO EN RABBITMQ
            # ==================================

            event = {
                "eventId": str(
                    uuid4()
                ),
                "rentalId": rental.id,
                "copyId": copy_id,
                "occurredAt": (
                    datetime.now(
                        timezone.utc
                    ).isoformat()
                ),
            }

            try:
                await (
                    publish_copy_return_requested(
                        event
                    )
                )

            except Exception as exc:
                raise GraphQLError(
                    "El alquiler fue marcado "
                    "como devuelto, pero no "
                    "se pudo publicar el evento "
                    "de devolución."
                ) from exc

            return to_graphql(
                rental
            )