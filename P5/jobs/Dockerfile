FROM python:3.12-alpine AS builder

WORKDIR /app

COPY requirements.txt .

RUN pip install \
    --no-cache-dir \
    --prefix=/install \
    -r requirements.txt


FROM python:3.12-alpine

WORKDIR /app

RUN addgroup -S appgroup \
    && adduser -S appuser -G appgroup

COPY --from=builder /install /usr/local

COPY db.py .
COPY cron_tick.py .
COPY cron_summary.py .
COPY summary_consumer.py .

USER appuser

CMD ["python", "cron_tick.py"]