# KanBang

[![CI](https://github.com/marcneubauer/KanBang/actions/workflows/ci.yml/badge.svg)](https://github.com/marcneubauer/KanBang/actions/workflows/ci.yml)

A self-hosted personal Trello clone — kanban boards with drag-and-drop, built for single-user use.

## Features

See **[docs/FEATURES.md](docs/FEATURES.md)** for the full feature guide (what each feature does, where it lives in the UI, and the API behind it) and **[docs/specs/03-rest-api.md](docs/specs/03-rest-api.md)** for the complete REST API reference.

Highlights:

- Boards, lists, and cards with drag-and-drop (fractional indexing), archive/undo, and board-scoped card numbers (#1, #2…)
- Cards: due dates, markdown descriptions, checklists, labels, comments, covers (color/image), templates, copy/move across boards, quick edit
- Lists: sort, WIP limits, collapse, copy, move to another board, Done list with auto-move and auto-archive
- Boards: color/gradient backgrounds with derived accent theming, card aging, search and filters
- Quick-add REST endpoint with bearer-token auth for iOS/watchOS Shortcuts (dictate a task from an Apple Watch)
- Trello board import (JSON export) and full JSON data export
- Auth: password (argon2id) + passkeys/WebAuthn, cookie sessions with sliding expiry, rate limiting

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
│   ├── FEATURES.md # Feature guide (users + agents)
│   ├── logs/      # Session logs
│   └── archive/   # Retired plans and pre-dex tracking
├── docker-compose.yml
├── Dockerfile.api
└── Dockerfile.web
```

## Commands

```bash
pnpm dev          # Start API + Web in parallel
pnpm build        # Build all packages
pnpm test         # Run Vitest tests (unit + integration)
pnpm test:e2e     # Run Playwright E2E tests
pnpm typecheck    # TypeScript type checking
pnpm lint         # ESLint
pnpm format       # Prettier
pnpm db:generate  # Generate a Drizzle migration from schema changes
pnpm db:migrate   # Apply migrations
```

## Environment Variables

See [.env.example](.env.example) for all available configuration options.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `./kanbang.db` | SQLite database file path |
| `SESSION_SECRET` | — | Secret for session management (min 32 chars) |
| `API_PORT` / `API_HOST` | `3001` / `0.0.0.0` | API listen address |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS so session cookies are Secure |
| `RP_ID` | `localhost` | WebAuthn Relying Party ID (your domain) |
| `RP_ORIGIN` | `http://localhost:3000` | WebAuthn origin URL |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `API_URL` | `http://localhost:3001` | Backend URL (used by SvelteKit server) |
| `RATE_LIMIT_MAX` | `10` (auth) / `30` (quick-add) | Requests per minute on rate-limited endpoints |
| `UPLOADS_DIR` | `./data/uploads` | Directory for uploaded images (keep beside the DB so one volume backs up both) |
| `UPLOAD_MAX_BYTES` | `10485760` | Max image upload size (10 MiB) |
| `LOG_LEVEL` | `info` | API log level |

## License

Personal project — not licensed for redistribution.
