# Project Rename Plan: Trailo → KanBang

**Status: Completed** — Rename fully applied. GitHub repo also renamed from `trailo` to `KanBang`.

## Summary

Rename the project from **Trailo** to **KanBang** across the entire codebase. The name "kan!" is not viable due to special character restrictions (see below), so **kanbang** is the recommended machine name with **KanBang** as the display name.

## Why Not "kan!"?

The `!` character is **incompatible** with multiple critical systems:

| System | `!` Allowed? | Notes |
|--------|:---:|-------|
| HTTP cookie names | No | Only alphanumeric, `_`, `-` per spec |
| npm/pnpm package names | Technically yes | Causes shell escaping nightmares |
| Docker image names | No | Only `[a-z0-9_.-]` |
| Environment variables | No | Only `[A-Za-z0-9_]` |
| Git repository names | No | Only `[A-Za-z0-9_.-]` |
| Shell commands | No | `!` triggers history expansion in bash/zsh |

**Verdict:** Use `kanbang` as the machine-safe name and `KanBang` for display/branding.

---

## Difficulty Assessment

**Overall: Low-Medium** — Straightforward find-and-replace with no architectural changes. The rename is mechanical but touches many files (~80+ locations).

| Category | Difficulty | File Count | Notes |
|----------|:---:|:---:|-------|
| Package scope (`@trailo/` → `@kanbang/`) | Low | ~15 files | Bulk replace in imports + package.json |
| Cookie names (`trailo_session` etc.) | Low | ~10 files | Search-replace, but **breaks existing sessions** |
| Database filename (`trailo.db`) | Low | ~5 files | Config change only |
| UI display text | Low | ~3 files | "Trailo" → "KanBang" in nav/login |
| Documentation & specs | Low | ~15 files | Cosmetic |
| E2E test assertions | Low | ~2 files | Match new UI text |
| Docker/deployment config | Low | ~3 files | Image names, env vars |
| CLAUDE.md project guide | Low | 1 file | Update name references |

### Risk Areas

1. **Existing sessions invalidated** — Cookie rename means all logged-in users get logged out. Acceptable for a personal app.
2. **Existing database file** — Users with a `trailo.db` file need to rename it (or keep the old DB name as a config option).
3. **pnpm lockfile regeneration** — Changing package names requires `pnpm install` to regenerate the lockfile.
4. **Git history** — The rename doesn't affect git history, just going-forward references.

---

## Rename Mapping

| Current | New (machine) | New (display) |
|---------|---------------|---------------|
| `trailo` | `kanbang` | KanBang |
| `Trailo` | `KanBang` | KanBang |
| `@trailo/shared` | `@kanbang/shared` | — |
| `@trailo/api` | `@kanbang/api` | — |
| `@trailo/web` | `@kanbang/web` | — |
| `trailo_session` | `kanbang_session` | — |
| `trailo_webauthn_challenge` | `kanbang_webauthn_challenge` | — |
| `trailo.db` | `kanbang.db` | — |
| `RP_NAME=Trailo` | `RP_NAME=KanBang` | — |

---

## Execution Steps

### Step 1: Package names & scope (4 files)

- `package.json` — `"name": "trailo"` → `"name": "kanbang"`
- `packages/shared/package.json` — `@trailo/shared` → `@kanbang/shared`
- `packages/api/package.json` — `@trailo/api` → `@kanbang/api`
- `packages/web/package.json` — `@trailo/web` → `@kanbang/web`

### Step 2: Import statements (~40 files)

Bulk replace `@trailo/` → `@kanbang/` across all `.ts` and `.svelte` files in:
- `packages/api/src/**`
- `packages/web/src/**`
- `packages/api/tests/**`
- `packages/shared/src/**`

### Step 3: Cookie & session names (~10 files)

Replace in:
- `packages/api/src/plugins/auth.ts` — `trailo_session`
- `packages/api/src/routes/auth/index.ts` — `trailo_session`
- `packages/api/src/routes/passkeys/index.ts` — `trailo_webauthn_challenge`
- `packages/api/tests/integration/helpers.ts` — `trailo_session`
- `packages/api/tests/integration/passkeys.test.ts` — cookie names
- `packages/web/src/hooks.server.ts` — `trailo_session`
- `packages/web/src/routes/boards/+page.server.ts` — `trailo_session`
- `packages/web/src/routes/boards/[boardId]/+page.server.ts` — `trailo_session`
- `packages/web/src/routes/settings/+page.server.ts` — `trailo_session`

### Step 4: Database filename (~5 files)

- `.env.example` — `trailo.db` → `kanbang.db`
- `packages/api/drizzle.config.ts` — default DB path
- `packages/api/src/config.ts` — default DB path
- `docker-compose.yml` — volume mount reference

### Step 5: UI display text (~3 files)

- `packages/web/src/routes/+layout.svelte` — nav brand "Trailo" → "KanBang"
- `packages/web/src/routes/login/+page.svelte` — "Sign in to Trailo" → "Sign in to KanBang"
- `packages/api/src/config.ts` — `RP_NAME` default

### Step 6: E2E test assertions (~2 files)

- `e2e/auth.spec.ts` — text assertion for login page

### Step 7: Docker & deployment (~3 files)

- `docker-compose.yml` — `RP_NAME` default, volume name
- `Dockerfile.web` — `@trailo/web` filter reference
- `.env.example` — `RP_NAME=KanBang`

### Step 8: Documentation (~15 files)

- `README.md`
- `CLAUDE.md`
- `handoff.md`
- `specs/00-project-overview.md` through `specs/07-testing-strategy.md`

### Step 9: Regenerate lockfile

```bash
pnpm install
```

### Step 10: Run root-level scripts

Update any `pnpm --filter` commands in root `package.json` that reference `@trailo/*`.

---

## Verification

1. `pnpm install` — lockfile regenerates without errors
2. `pnpm typecheck` — no broken imports
3. `pnpm build` — clean build
4. `pnpm test` — all unit/integration tests pass
5. `pnpm test:e2e` — all E2E tests pass (login text assertions updated)
6. Manual check: login page shows "KanBang", nav shows "KanBang"
7. Docker build: `docker compose build` succeeds

---

## Estimated Effort

~30 minutes of mechanical find-and-replace work. No architectural changes, no database migrations, no API contract changes.
