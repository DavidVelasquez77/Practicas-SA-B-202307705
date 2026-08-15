from datetime import datetime

import strawberry


@strawberry.type
class Rental:
    id: int
    user_id: int
    comic_id: int
    copy_id: int

    fecha_alquiler: datetime
    fecha_limite: datetime
    fecha_devolucion: datetime | None

    precio_alquiler: float
    estado: str