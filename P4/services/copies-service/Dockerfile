# =========================
# STAGE 1 - BUILDER
# =========================
FROM python:3.12-slim AS builder

WORKDIR /app

COPY requirements.txt .

RUN pip install \
    --no-cache-dir \
    --prefix=/install \
    -r requirements.txt


# =========================
# STAGE 2 - RUNTIME
# =========================
FROM python:3.12-slim

WORKDIR /app

RUN groupadd --system appgroup \
    && useradd \
        --system \
        --gid appgroup \
        --create-home \
        appuser

COPY --from=builder /install /usr/local

COPY app ./app

RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8002


CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]