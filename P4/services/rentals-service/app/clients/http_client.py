import httpx

from app.observability import inject_correlation_id
from app.config import (
    HTTP_TIMEOUT_SECONDS,
)


http_client = httpx.AsyncClient(
    timeout=HTTP_TIMEOUT_SECONDS,
    event_hooks={"request": [inject_correlation_id]},
)


async def close_http_client() -> None:
    await http_client.aclose()
