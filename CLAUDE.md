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

## Task Management

Tasks live in `.dex/` (committed) and sync to GitHub Issues automatically.

- Use `/dex` to plan and track work persistently across sessions.
- Local-first: `dex list`, `dex list --all`, `dex show <id>` read from `.dex/` without network calls.
- Issues created on GitHub: run `dex import --all` (or `dex import #N`) to pull them into `.dex/`. Apply the `dex` label to remote-created issues you want round-tripped via `--all`.
- Always pass `--commit <sha>` (or `--no-commit`) to `dex complete` so issues close cleanly on push.
- The pre-dex docs/plans and docs/logs folders are archived under docs/archive/.

## Documentation

- `docs/FEATURES.md` — user/agent-facing feature guide (what each feature does, UI location, backing endpoints)
- `docs/specs/03-rest-api.md` — complete REST API reference, including the Object Field Reference section
- `README.md` — feature highlights + links to the above

**Keep docs current: whenever a feature is added or changed, update `docs/FEATURES.md` and `docs/specs/03-rest-api.md` (and the README highlights if user-visible) in the same change.** New endpoints, new request/response fields, and new UI surfaces all count as changes.

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
│   └── archive/   # Pre-dex task tracking (plans, logs, feature-ideas), frozen for reference
└── playwright.config.ts
```

## Environment Setup

- **Node.js 25** via NVM (`.nvmrc` present)
- **pnpm** via corepack: `corepack enable pnpm`
- Run `pnpm` commands directly (e.g. `pnpm test`, `pnpm typecheck`)

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

- **Fractional indexing** for list/card/checklist positions: string-based lexicographic keys, only 1 row update per reorder
- **13 tables**: users, credentials, sessions, api_tokens, boards, lists, cards, checklists, checklist_items, labels, card_labels, comments, attachments
- **Uploaded images** live on disk under `UPLOADS_DIR` (default `packages/api/data/uploads`, gitignored); the attachments table holds metadata only
- **Cascade deletes**: boards → lists → cards → checklists/comments; labels and card numbers are board-scoped (never survive cross-board moves)
- **IDs**: nanoid text primary keys; cards also carry a board-scoped auto-increment `number`

### Auth

- Cookie-based sessions (`kanbang_session`, HttpOnly, 30-day sliding expiry)
- argon2id password hashing
- Session stored in DB, validated on each request
- `POST /api/v1/quick-add` uses per-user bearer tokens (sha256-hashed in api_tokens) instead of cookies

## Testing Conventions

- **Unit tests**: `*.test.ts` co-located or in `tests/` directories
- **Integration tests**: `packages/api/tests/integration/` — use `buildApp()` + `app.inject()`
- **E2E tests**: `e2e/*.spec.ts` — each test creates its own user for isolation
- **Test DB**: In-memory SQLite (`:memory:`) for unit/integration; file-based (`e2e-test.db`) for E2E

## pnpm Workspace Rules

**Always run pnpm commands from the repo root**, never from inside a package directory.

- Use `pnpm --filter @kanbang/web add zod` to add a dep to a specific package
- Do NOT `cd packages/web && pnpm add zod` — this corrupts the lockfile

**Why:** Running `pnpm add` from inside a package subdirectory regenerates lockfile entries with stale peer-dependency hashes. In this monorepo, the root `vitest.config.ts` uses a `projects` array to run all tests in one process. The web package's `vitest` binary gets a peer hash that includes `jsdom`, but a sub-directory install strips that, producing a binary that points to a non-existent store path. The result is a `Cannot find module …/vitest/vitest.mjs` crash that a plain `pnpm install` from the root does not fix — only `pnpm install --force` (which rebuilds all binaries) recovers it. Avoid the problem entirely by always operating from the root.

## Important Notes

- Drizzle schema cross-references use extensionless imports (for drizzle-kit CJS compatibility)
- The barrel `schema.ts` file uses `.js` extensions (loaded by tsx at runtime)
- `pnpm-workspace.yaml` has `onlyBuiltDependencies` for argon2, better-sqlite3, esbuild
- SvelteKit build produces only warnings (a11y hints, state_referenced_locally) — these are expected
