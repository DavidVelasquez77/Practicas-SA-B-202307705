# =========================
# STAGE 1 - BUILDER
# =========================
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY prisma ./prisma

COPY . .

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
    && npm cache clean --force

COPY --from=builder /app/dist ./dist

RUN groupadd --system appgroup \
    && useradd \
        --system \
        --gid appgroup \
        appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

CMD ["node", "dist/main.js"]