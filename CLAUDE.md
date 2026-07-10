# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Install dependencies (uses Bun workspaces)
bun install

# Run full stack development (frontend + server)
bun run dev

# Run only the server
bun run start

# Build all packages
bun run build

# Run server tests
cd packages/server && bun test

# Run frontend dev server only
cd packages/frontend && bun run dev

# Lint frontend
cd packages/frontend && bun run lint
```

## Architecture

This is a **Bun monorepo** with four packages:

- **@npubcash/server** (`packages/server/`) - Express.js backend with WebSocket support
- **@npubcash/frontend** (`packages/frontend/`) - React 19 SPA with TanStack Router and Vite
- **npubcash-sdk** (`packages/sdk/`) - Publishable client library for the npubcash API
- **npubcash-types** (`packages/types/`) - Shared TypeScript type definitions

### Server Architecture

The server uses domain-driven design:

- **Domain layer** (`domain/`) - Business logic services (UserService, MintService, ProofService, CommunicatorService)
- **Controller layer** (`controller/`) - HTTP request handlers
- **Infrastructure** (`infrastructure/db/`) - Repository pattern implementations
- **Database** (`database/`) - Adapter pattern supporting PostgreSQL and SQLite

Key patterns:
- Event bus for decoupled communication (e.g., `quotePaid` events)
- Hybrid transport system for mint communication (WebSocket + HTTP polling with automatic fallback)
- NIP-98 authentication (Nostr signed events) and JWT tokens

### Frontend Architecture

- TanStack Router with file-based routing (`routes/`)
- AuthContext for authentication state
- CoCo Cashu libraries for token management
- Vite proxies `/api` to backend at `localhost:8000`

## Database

Supports dual databases via adapter pattern:
- **PostgreSQL**: Recommended for production (set `DATABASE_URL`)
- **SQLite**: Development default, or an explicit production choice backed by a persistent volume

Production requires `DATABASE_URL` unless SQLite is explicitly selected with
`DATABASE_TYPE=sqlite`. PostgreSQL URLs and SQLite file paths infer the database
type when `DATABASE_TYPE` is omitted.

Migrations run automatically on startup and support both databases.

## Protocols

- **Cashu** - eCash token protocol
- **Nostr** - Decentralized identity (NIP-05, NIP-98, NIP-57)
- **LNURL** - Lightning payment URLs
- **NUT-17** - Cashu mint WebSocket subscriptions

## Commit Style

Format: `type(scope): message`
- No description body, no co-authoring
- Types: `feat`, `refactor`, `build`, `project`, `deps`, `version`, `clean`
- Scopes: `sdk`, `frontend`, `server`, `project`
- Messages lowercase, no trailing period

Examples:
```
feat(server): add hybrid subscription manager
refactor(frontend): simplify auth context
deps(sdk): update cashu-ts to v3
```
