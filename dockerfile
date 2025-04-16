FROM node:22-alpine AS base

FROM base AS builder
RUN corepack enable yarn

ARG HOSTNAME
ENV NPC_SERVER_URL=${HOSTNAME}

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json yarn.lock .yarnrc.yml ./
COPY packages ./packages

RUN yarn install --frozen-lockfile
RUN yarn build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 npc

COPY --from=builder --chown=npc:nodejs /app/dist ./dist
COPY --from=builder --chown=npc:nodejs /app/packages/server/migrations ./packages/server/migrations/

USER npc

EXPOSE 8000

ENV PORT 8000 

ENV ROOT_DIR /app

CMD ["node", "dist/server/index.cjs"]
