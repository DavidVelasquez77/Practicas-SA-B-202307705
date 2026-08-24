# =========================
# BUILD
# =========================
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build


# =========================
# RUNTIME
# =========================
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN groupadd --system appgroup \
    && useradd \
        --system \
        --gid appgroup \
        appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

CMD ["node", "dist/main.js"]