from fastapi import HTTPException
from sqlalchemy import select

from app.database import SessionLocal
from app.models.comic_copy import (
    ComicCopyModel,
)
from app.schemas.comic_copy import (
    CreateComicCopy,
)


class CopiesService:

    @staticmethod
    async def create(
        data: CreateComicCopy,
    ) -> ComicCopyModel:

        async with SessionLocal() as session:

            existing_result = await session.execute(
                select(ComicCopyModel).where(
                    ComicCopyModel.codigo
                    == data.codigo.strip()
                )
            )

            existing = (
                existing_result
                .scalars()
                .first()
            )

            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Ya existe un ejemplar "
                        "con ese código."
                    ),
                )

            copy = ComicCopyModel(
                comic_id=data.comic_id,
                codigo=data.codigo.strip(),
                estado="DISPONIBLE",
            )

            session.add(copy)

            await session.commit()
            await session.refresh(copy)

            return copy

    @staticmethod
    async def find_all() -> list[ComicCopyModel]:

        async with SessionLocal() as session:

            result = await session.execute(
                select(ComicCopyModel)
                .order_by(
                    ComicCopyModel.id.asc()
                )
            )

            return list(
                result.scalars().all()
            )

    @staticmethod
    async def find_one(
        copy_id: int,
    ) -> ComicCopyModel:

        async with SessionLocal() as session:

            copy = await session.get(
                ComicCopyModel,
                copy_id,
            )

            if copy is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "El ejemplar no existe."
                    ),
                )

            return copy

    @staticmethod
    async def find_by_comic(
        comic_id: int,
    ) -> list[ComicCopyModel]:

        async with SessionLocal() as session:

            result = await session.execute(
                select(ComicCopyModel)
                .where(
                    ComicCopyModel.comic_id
                    == comic_id
                )
                .order_by(
                    ComicCopyModel.id.asc()
                )
            )

            return list(
                result.scalars().all()
            )

    @staticmethod
    async def find_available(
        comic_id: int,
    ) -> ComicCopyModel:

        async with SessionLocal() as session:

            result = await session.execute(
                select(ComicCopyModel)
                .where(
                    ComicCopyModel.comic_id
                    == comic_id,
                    ComicCopyModel.estado
                    == "DISPONIBLE",
                )
                .order_by(
                    ComicCopyModel.id.asc()
                )
            )

            copy = (
                result
                .scalars()
                .first()
            )

            if copy is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "No existen ejemplares "
                        "disponibles para este comic."
                    ),
                )

            return copy

    @staticmethod
    async def mark_as_rented(
        copy_id: int,
    ) -> ComicCopyModel:

        async with SessionLocal() as session:

            copy = await session.get(
                ComicCopyModel,
                copy_id,
            )

            if copy is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "El ejemplar no existe."
                    ),
                )

            if copy.estado != "DISPONIBLE":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "El ejemplar no está "
                        "disponible."
                    ),
                )

            copy.estado = "ALQUILADO"

            await session.commit()
            await session.refresh(copy)

            return copy

    @staticmethod
    async def mark_as_available(
        copy_id: int,
    ) -> ComicCopyModel:

        async with SessionLocal() as session:

            copy = await session.get(
                ComicCopyModel,
                copy_id,
            )

            if copy is None:
                raise HTTPException(
                    status_code=404,
                    detail=(
                        "El ejemplar no existe."
                    ),
                )

            if copy.estado != "ALQUILADO":
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "El ejemplar no está "
                        "actualmente alquilado."
                    ),
                )

            copy.estado = "DISPONIBLE"

            await session.commit()
            await session.refresh(copy)

            return copy