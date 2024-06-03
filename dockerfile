FROM node:18-alpine AS base

FROM base AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 npc

COPY --from=builder --chown=npc:nodejs /app/dist ./
COPY --from=builder --chown=npc:nodejs /app/migrations ./migrations
 
USER npc

EXPOSE 8000

ENV PORT 8000 


CMD HOSTNAME="0.0.0.0" node index.js
