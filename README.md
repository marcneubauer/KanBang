# KanBang

[![CI](https://github.com/marcneubauer/KanBang/actions/workflows/ci.yml/badge.svg)](https://github.com/marcneubauer/KanBang/actions/workflows/ci.yml)

A self-hosted personal Trello clone — kanban boards with drag-and-drop, built for single-user use.

## Features

- Boards, lists, and cards with full CRUD
- Drag-and-drop reordering (lists and cards, including cross-list moves)
- Fractional indexing for efficient position updates
- Password authentication (argon2id)
- Passkey/WebAuthn authentication (register passkeys, passwordless login)
- Cookie-based sessions with sliding expiry
- Responsive UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify 5 |
| Frontend | SvelteKit 2 / Svelte 5 |
| Database | SQLite (better-sqlite3 + Drizzle ORM) |
| Auth | Password (argon2) + Passkeys (@simplewebauthn) |
| Monorepo | pnpm workspaces |
| Testing | Vitest + Playwright |
| Deployment | Docker Compose |

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm (`corepack enable pnpm`)

### Development

```bash
# Install dependencies
pnpm install

# Start API and web dev servers
pnpm dev
```

The API runs on `http://localhost:3001` and the web app on `http://localhost:5173`.

### Docker Compose (Production)

```bash
# Copy and edit environment variables
cp .env.example .env

# Build and start
docker compose up --build -d
```

The app is accessible at `http://localhost:3000`.

## Project Structure

```
kanbang/
├── packages/
│   ├── shared/    # @kanbang/shared — types, Zod schemas, fractional-index util
│   ├── api/       # @kanbang/api — Fastify REST API (port 3001)
│   └── web/       # @kanbang/web — SvelteKit frontend (port 5173 dev / 3000 prod)
├── e2e/           # Playwright E2E tests
├── docs/
│   ├── specs/     # Specification documents
│   └── plans/     # Planning documents
├── docker-compose.yml
├── Dockerfile.api
└── Dockerfile.web
```

## Commands

```bash
pnpm dev          # Start API + Web in parallel
pnpm build        # Build all packages
pnpm test         # Run Vitest tests (70 tests)
pnpm test:e2e     # Run Playwright E2E tests (20 tests)
pnpm typecheck    # TypeScript type checking
pnpm lint         # ESLint
pnpm format       # Prettier
```

## Environment Variables

See [.env.example](.env.example) for all available configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `./kanbang.db` | SQLite database file path |
| `SESSION_SECRET` | — | Secret for session management (min 32 chars) |
| `RP_ID` | `localhost` | WebAuthn Relying Party ID (your domain) |
| `RP_ORIGIN` | `http://localhost:3000` | WebAuthn origin URL |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `API_URL` | `http://localhost:3001` | Backend URL (used by SvelteKit server) |

## License

Personal project — not licensed for redistribution.
