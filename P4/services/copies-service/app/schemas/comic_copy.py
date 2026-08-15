from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)


class CreateComicCopy(BaseModel):
    comic_id: int = Field(
        gt=0
    )

    codigo: str = Field(
        min_length=2,
        max_length=50,
    )


class ComicCopyResponse(BaseModel):
    model_config = ConfigDict(
        from_attributes=True
    )

    id: int
    comic_id: int
    codigo: str
    estado: str
    created_at: datetime
    updated_at: datetime