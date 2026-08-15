import httpx

from app.clients.errors import (
    RemoteServiceError,
)
from app.clients.http_client import (
    http_client,
)
from app.config import (
    COPIES_SERVICE_URL,
)


def error_detail(
    response: httpx.Response,
) -> str:

    try:
        payload = response.json()

        return payload.get(
            "detail",
            "Error en Copies Service.",
        )

    except ValueError:
        return (
            "Copies Service devolvió "
            "una respuesta inválida."
        )


class CopiesClient:

    @staticmethod
    async def find_available(
        comic_id: int,
    ) -> dict:

        url = (
            f"{COPIES_SERVICE_URL}"
            f"/copies/available/"
            f"by-comic/{comic_id}"
        )

        try:
            response = (
                await http_client.get(
                    url
                )
            )

        except httpx.RequestError as exc:
            raise RemoteServiceError(
                "No se pudo comunicar "
                "con Copies Service."
            ) from exc

        if response.status_code == 404:
            raise RemoteServiceError(
                "No existen ejemplares "
                "disponibles para este comic."
            )

        if response.is_error:
            raise RemoteServiceError(
                error_detail(response)
            )

        return response.json()

    @staticmethod
    async def mark_as_rented(
        copy_id: int,
    ) -> dict:

        url = (
            f"{COPIES_SERVICE_URL}"
            f"/copies/{copy_id}/rent"
        )

        try:
            response = (
                await http_client.patch(
                    url
                )
            )

        except httpx.RequestError as exc:
            raise RemoteServiceError(
                "No se pudo marcar el "
                "ejemplar como alquilado."
            ) from exc

        if response.is_error:
            raise RemoteServiceError(
                error_detail(response)
            )

        return response.json()

    @staticmethod
    async def mark_as_available(
        copy_id: int,
    ) -> dict:

        url = (
            f"{COPIES_SERVICE_URL}"
            f"/copies/{copy_id}/return"
        )

        try:
            response = (
                await http_client.patch(
                    url
                )
            )

        except httpx.RequestError as exc:
            raise RemoteServiceError(
                "No se pudo devolver "
                "el ejemplar."
            ) from exc

        if response.is_error:
            raise RemoteServiceError(
                error_detail(response)
            )

        return response.json()