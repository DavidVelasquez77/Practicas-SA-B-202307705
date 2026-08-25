import os
import psycopg


def get_connection():
    database_url = os.environ["DATABASE_URL"]

    database_url = database_url.replace(
        "postgresql+psycopg://",
        "postgresql://"
    )

    return psycopg.connect(database_url)


def ensure_tables():
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS cron_ticks (
                    id BIGSERIAL PRIMARY KEY,
                    carnet VARCHAR(20) NOT NULL,
                    executed_at TIMESTAMPTZ NOT NULL,
                    timezone VARCHAR(20) NOT NULL
                );
                """
            )

            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS hourly_summaries (
                    event_id UUID PRIMARY KEY,
                    carnet VARCHAR(20) NOT NULL,
                    hour_start TIMESTAMPTZ NOT NULL,
                    hour_end TIMESTAMPTZ NOT NULL,
                    total_ticks INTEGER NOT NULL,
                    generated_at TIMESTAMPTZ NOT NULL,
                    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );
                """
            )

        conn.commit()