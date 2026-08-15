from datetime import datetime, timezone

from sqlalchemy import (
    DateTime,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.database import Base


class ComicCopyModel(Base):
    __tablename__ = "comic_copies"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )

    comic_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    codigo: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        unique=True,
    )

    estado: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="DISPONIBLE",
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc
        ),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc
        ),
        onupdate=lambda: datetime.now(
            timezone.utc
        ),
    )

    __table_args__ = (
        Index(
            "idx_comic_copies_comic_id",
            "comic_id",
        ),
        Index(
            "idx_comic_copies_estado",
            "estado",
        ),
    )