FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY prisma ./prisma

RUN npx prisma generate

COPY . .

RUN npm run build


FROM node:22-slim

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

RUN groupadd --system appgroup \
    && useradd \
        --system \
        --gid appgroup \
        appuser \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3001

CMD ["node", "dist/main.js"]