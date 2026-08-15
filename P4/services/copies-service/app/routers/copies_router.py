from fastapi import (
    APIRouter,
    status,
)

from app.schemas.comic_copy import (
    ComicCopyResponse,
    CreateComicCopy,
)
from app.services.copies_service import (
    CopiesService,
)


router = APIRouter(
    prefix="/copies",
    tags=["Copies"],
)


@router.post(
    "",
    response_model=ComicCopyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_copy(
    data: CreateComicCopy,
):
    return await CopiesService.create(
        data
    )


@router.get(
    "",
    response_model=list[ComicCopyResponse],
)
async def get_copies():
    return await CopiesService.find_all()


@router.get(
    "/by-comic/{comic_id}",
    response_model=list[ComicCopyResponse],
)
async def get_copies_by_comic(
    comic_id: int,
):
    return await CopiesService.find_by_comic(
        comic_id
    )


@router.get(
    "/available/by-comic/{comic_id}",
    response_model=ComicCopyResponse,
)
async def get_available_copy(
    comic_id: int,
):
    return await CopiesService.find_available(
        comic_id
    )


@router.get(
    "/{copy_id}",
    response_model=ComicCopyResponse,
)
async def get_copy(
    copy_id: int,
):
    return await CopiesService.find_one(
        copy_id
    )


@router.patch(
    "/{copy_id}/rent",
    response_model=ComicCopyResponse,
)
async def rent_copy(
    copy_id: int,
):
    return await CopiesService.mark_as_rented(
        copy_id
    )


@router.patch(
    "/{copy_id}/return",
    response_model=ComicCopyResponse,
)
async def return_copy(
    copy_id: int,
):
    return (
        await CopiesService.mark_as_available(
            copy_id
        )
    )