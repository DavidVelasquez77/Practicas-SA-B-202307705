import httpx

from app.config import (
    HTTP_TIMEOUT_SECONDS,
)


http_client = httpx.AsyncClient(
    timeout=HTTP_TIMEOUT_SECONDS,
)


async def close_http_client() -> None:
    await http_client.aclose()