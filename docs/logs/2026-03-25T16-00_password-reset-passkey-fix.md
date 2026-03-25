# Session Log — 2026-03-25 16:00

## Goal

Reset a forgotten password and fix passkey registration origin mismatch.

## Actions

### Prompt 1 — How to create a passkey / recover a locked account

- Explored auth routes (`packages/api/src/routes/auth/index.ts`) and passkey routes (`packages/api/src/routes/passkeys/index.ts`)
- Explored frontend login and settings pages for passkey UI
- Explained the full passkey registration and login flows
- Noted there is no password reset feature — suggested direct DB reset or building the feature

### Prompt 2 — Reset password directly

- Found the SQLite database at `packages/api/kanbang.db`
- Listed users (single user: marc)
- Generated an argon2id hash for the new password
- Updated `password_hash` in the users table
- Added "Password reset flow" to the feature ideas backlog in memory

### Prompt 3 — Fix passkey registration origin error

- Error: `Unexpected registration response origin "http://localhost:5173", expected "http://localhost:3000"`
- Found `RP_ORIGIN` default was `http://localhost:3000` in `packages/api/src/config.ts`
- Changed default to `http://localhost:5173` to match the SvelteKit dev server origin

### Prompt 4 — Create feature ideas doc and commit

- Copied feature ideas from memory to `docs/feature-ideas.md`
- Created this session log

## Files Modified

| File | Change |
|------|--------|
| `packages/api/src/config.ts` | Changed `RP_ORIGIN` default from `http://localhost:3000` to `http://localhost:5173` |
| `docs/feature-ideas.md` | New file — feature ideas backlog |
| `docs/logs/2026-03-25T16-00_password-reset-passkey-fix.md` | New file — this session log |

## Key Decisions

- Reset password directly in SQLite rather than building a full password reset flow (deferred to future)
- Changed `RP_ORIGIN` default rather than requiring an env var for dev, since `5173` is the actual dev origin
