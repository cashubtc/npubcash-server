FROM oven/bun:1.3.14 AS base

FROM base AS builder

RUN apt-get update \
    && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
COPY packages ./packages

RUN bun install --frozen-lockfile
RUN bun run build

FROM base

WORKDIR /app

ENV NODE_ENV=production
ENV API_MODE=BOTH
ENV PORT=8000

RUN mkdir -p /data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/server ./packages/server
COPY --from=builder /app/packages/frontend/dist ./packages/frontend/dist

EXPOSE 8000

CMD ["bun", "packages/server/src/index.ts"]
