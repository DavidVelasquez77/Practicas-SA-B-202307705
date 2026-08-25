from datetime import datetime, timezone, timedelta

from db import get_connection, ensure_tables


CARNET = "202307705"
GT_OFFSET = timezone(timedelta(hours=-6))


def main():
    ensure_tables()

    now_gt = datetime.now(GT_OFFSET)

    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO cron_ticks (
                    carnet,
                    executed_at,
                    timezone
                )
                VALUES (%s, %s, %s)
                RETURNING id;
                """,
                (
                    CARNET,
                    now_gt,
                    "GMT-6",
                )
            )

            tick_id = cursor.fetchone()[0]

        conn.commit()

    print(
        f"[CronJob Tick] id={tick_id} "
        f"carnet={CARNET} "
        f"fecha={now_gt.isoformat()} "
        f"timezone=GMT-6"
    )


if __name__ == "__main__":
    main()