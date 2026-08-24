# =========================
# STAGE 1 - BUILDER
# =========================
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY prisma ./prisma
COPY prisma.config.ts ./
COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npx prisma generate

RUN npm run build


# =========================
# STAGE 2 - RUNTIME
# =========================
FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev \
    && npm install --no-save prisma@7.9.1 \
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN groupadd --system appgroup \
    && useradd \
        --system \
        --gid appgroup \
        appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3002

CMD ["node", "dist/main.js"]