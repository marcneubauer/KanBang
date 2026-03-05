# KanBang — Claude Code Project Guide

## Overview

KanBang is a self-hosted personal Trello clone — a kanban board app with boards, lists, and cards. Drag-and-drop reordering uses fractional indexing.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Fastify 5 (REST API) |
| Frontend | SvelteKit 2 (Svelte 5 runes, adapter-node) |
| Database | SQLite via better-sqlite3 + Drizzle ORM |
| Auth | Password (argon2) + Passkeys (@simplewebauthn) |
| Monorepo | pnpm workspaces |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Deployment | Docker Compose |

## Monorepo Structure

```
kanbang/
├── packages/
│   ├── shared/    # @kanbang/shared — types, Zod schemas, fractional-index util
│   ├── api/       # @kanbang/api — Fastify backend (port 3001)
│   └── web/       # @kanbang/web — SvelteKit frontend (port 5173)
├── e2e/           # Playwright E2E tests
├── docs/
│   ├── specs/     # 8 specification documents (00–07)
│   └── plans/     # Planning documents: X_ are completed, O_ are not started, I_ are incomplete
└── playwright.config.ts
```

## Environment Setup

- **Node.js 22** via NVM (`.nvmrc` present)
- **pnpm** via corepack: `corepack enable pnpm`
- On this machine, NVM lazy-loading causes issues. Always use direct paths:
  ```bash
  /bin/bash -c 'export PATH="/Users/mneubauer/.nvm/versions/node/v22.14.0/bin:$PATH" && <command>'
  ```

## Key Commands

```bash
pnpm install                     # Install all deps
pnpm dev                         # Start API + Web in parallel
pnpm dev:api                     # Start API only (tsx watch)
pnpm dev:web                     # Start Web only (vite dev)
pnpm build                       # Build all packages
pnpm test                        # Run all Vitest tests
pnpm test:e2e                    # Run Playwright E2E tests
pnpm typecheck                   # Run tsc --noEmit across all packages
pnpm lint                        # ESLint
pnpm format                      # Prettier
pnpm db:generate                 # Drizzle-kit generate migration
pnpm db:migrate                  # Drizzle-kit apply migration
```

## Architecture Patterns

### Backend (Fastify)

- **app.ts / server.ts split**: `buildApp()` factory creates and configures the Fastify instance; `server.ts` calls it and listens. This enables `app.inject()` testing without opening ports.
- **Plugins**: `db.ts` (creates DB, runs migrations), `auth.ts` (session parsing, `requireAuth` preHandler)
- **Services**: Business logic in service classes (`AuthService`, `BoardService`, etc.) that take the Drizzle DB instance
- **Routes**: Thin handlers that validate input (Zod), call services, return responses

### Frontend (SvelteKit)

- **Svelte 5 runes**: Use `$state()`, `$props()`, `$derived()` — NOT legacy `let`/`export let` reactive declarations
- **Event handlers**: Use `onclick={fn}` — NOT `on:click={fn}`. For event modifiers, use inline: `onclick={(e) => { e.stopPropagation(); handler(); }}`
- **API proxy**: `hooks.server.ts` proxies `/api/*` requests from SvelteKit to Fastify backend
- **Auth check**: `hooks.server.ts` reads `kanbang_session` cookie on every request and sets `locals.user`
- **Client API**: `$lib/api.ts` typed fetch wrapper that calls `/api/v1/...` (proxied to backend)

### Database

- **Fractional indexing** for list/card positions: string-based lexicographic keys, only 1 row update per reorder
- **6 tables**: users, credentials, sessions, boards, lists, cards
- **Cascade deletes**: boards → lists → cards
- **IDs**: nanoid text primary keys

### Auth

- Cookie-based sessions (`kanbang_session`, HttpOnly, 30-day sliding expiry)
- argon2id password hashing
- Session stored in DB, validated on each request

## Testing Conventions

- **Unit tests**: `*.test.ts` co-located or in `tests/` directories
- **Integration tests**: `packages/api/tests/integration/` — use `buildApp()` + `app.inject()`
- **E2E tests**: `e2e/*.spec.ts` — each test creates its own user for isolation
- **Test DB**: In-memory SQLite (`:memory:`) for unit/integration; file-based (`e2e-test.db`) for E2E

## Important Notes

- Drizzle schema cross-references use extensionless imports (for drizzle-kit CJS compatibility)
- The barrel `schema.ts` file uses `.js` extensions (loaded by tsx at runtime)
- `pnpm-workspace.yaml` has `onlyBuiltDependencies` for argon2, better-sqlite3, esbuild
- SvelteKit build produces only warnings (a11y hints, state_referenced_locally) — these are expected
