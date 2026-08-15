import strawberry


@strawberry.input
class CreateRentalInput:
    user_id: int
    comic_id: int
    copy_id: int
    precio_alquiler: float

    dias: int = 7 