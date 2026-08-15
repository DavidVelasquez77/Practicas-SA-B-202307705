import httpx

from app.clients.errors import (
    RemoteServiceError,
)
from app.clients.http_client import (
    http_client,
)
from app.config import (
    COMICS_SERVICE_URL,
)


class ComicsClient:

    @staticmethod
    async def find_one(
        comic_id: int,
    ) -> dict:

        query = """
        query Comic($id: Int!) {
          comic(id: $id) {
            id
            titulo
            precioAlquiler
            activo
          }
        }
        """

        try:
            response = await http_client.post(
                COMICS_SERVICE_URL,
                json={
                    "query": query,
                    "variables": {
                        "id": comic_id,
                    },
                },
            )

            response.raise_for_status()

        except httpx.HTTPError as exc:
            raise RemoteServiceError(
                "No se pudo comunicar "
                "con Comics Service."
            ) from exc

        try:
            payload = response.json()
        except ValueError as exc:
            raise RemoteServiceError(
                "Comics Service devolvió "
                "una respuesta inválida."
            ) from exc

        errors = payload.get(
            "errors"
        )

        if errors:
            message = errors[0].get(
                "message",
                "Error GraphQL.",
            )

            raise RemoteServiceError(
                f"Comics Service: "
                f"{message}"
            )

        comic = (
            payload
            .get("data", {})
            .get("comic")
        )

        if comic is None:
            raise RemoteServiceError(
                "El comic solicitado "
                "no existe."
            )

        return comic