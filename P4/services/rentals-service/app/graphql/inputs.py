import strawberry


@strawberry.input
class CreateRentalInput:
    user_id: int
    comic_id: int
    dias: int = 7