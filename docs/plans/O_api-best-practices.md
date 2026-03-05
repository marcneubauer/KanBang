# API Best Practices Improvements

## Context

An audit of `@kanbang/api` against Node.js best practices revealed several gaps — most critically around graceful shutdown (important for Docker deployment), environment validation (silent misconfigurations), and error handling consistency. This plan addresses each finding in priority order.

## Changes

### 1. Graceful Shutdown — `server.ts`

**File:** `packages/api/src/server.ts`

- Install `close-with-grace` (from the Fastify org)
- After `app.listen()`, register `closeWithGrace()` to handle SIGTERM/SIGINT and unhandled errors
- Calls `app.close()` which triggers Fastify's `onClose` hooks (DB cleanup etc.)

```typescript
import closeWithGrace from 'close-with-grace';

closeWithGrace({ delay: 10000 }, async ({ signal, err }) => {
  if (err) app.log.error(err);
  app.log.info(`${signal} received, shutting down`);
  await app.close();
});
```

### 2. Environment Validation with Zod — `config.ts`

**File:** `packages/api/src/config.ts`

- Replace the plain object with a Zod schema that validates at startup
- Fail fast with clear error messages for missing/invalid env vars
- `SESSION_SECRET` gets a `.min(32)` check (only enforced when explicitly set or in production — keep a dev default)
- Add `COOKIE_SECURE` boolean env var to replace `NODE_ENV` check

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  API_PORT: z.coerce.number().default(3001),
  API_HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().default('./kanbang.db'),
  SESSION_SECRET: z.string().min(32).default('dev-secret-change-in-production-min-32-chars'),
  COOKIE_SECURE: z.coerce.boolean().default(false),
  RP_ID: z.string().default('localhost'),
  RP_NAME: z.string().default('KanBang'),
  RP_ORIGIN: z.string().url().default('http://localhost:3000'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});
```

Export a typed `config` object derived from the parse result. Shape stays the same (nested `rp`, `cors` sub-objects) so consumers don't change.

### 3. Replace `NODE_ENV` with `COOKIE_SECURE` — `routes/auth/index.ts`

**File:** `packages/api/src/routes/auth/index.ts`

- Change `secure: process.env.NODE_ENV === 'production'` → `secure: config.cookieSecure`
- Import `config` (already available in the project)

### 4. Centralized Error Handler — `app.ts`

**File:** `packages/api/src/app.ts`

- Add `app.setErrorHandler()` that standardizes error response format
- Logs errors via `request.log.error(error)`
- Returns `{ error, code }` consistently

```typescript
app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? 'INTERNAL_ERROR';
  reply.status(statusCode).send({
    error: statusCode >= 500 ? 'Internal server error' : error.message,
    code,
  });
});
```

This doesn't change existing route handlers — they still manually send replies for expected errors (400, 401, 403, 404, 409). The error handler catches unexpected throws and ensures they get a clean 500 response instead of Fastify's default.

### 5. Robust SQLite Error Matching — `routes/auth/index.ts`

**File:** `packages/api/src/routes/auth/index.ts`

- Replace `err.message?.includes('UNIQUE constraint failed')` with a check on the SQLite error code
- better-sqlite3 errors have a `code` property: `'SQLITE_CONSTRAINT_UNIQUE'`

```typescript
if (err instanceof Error && (err as any).code === 'SQLITE_CONSTRAINT_UNIQUE') {
```

### 6. Configure Logger — `app.ts`

**File:** `packages/api/src/app.ts`

- Change `logger: opts.logger ?? true` to accept a Pino config object
- Add sensitive header redaction and configurable log level
- Keep test override (`logger: false`) working

```typescript
logger: opts.logger ?? {
  level: process.env.LOG_LEVEL || 'info',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
},
```

Update `BuildAppOptions.logger` type from `boolean` to `boolean | object`.

## Files Modified

| File | Change |
|------|--------|
| `packages/api/package.json` | Add `close-with-grace` dependency |
| `packages/api/src/server.ts` | Add graceful shutdown |
| `packages/api/src/config.ts` | Zod-validated env config + `cookieSecure` field |
| `packages/api/src/app.ts` | Error handler + logger config |
| `packages/api/src/routes/auth/index.ts` | Use `config.cookieSecure`, fix SQLite error check |

## Verification

1. `pnpm typecheck` — no new type errors
2. `pnpm test` — all existing tests pass
3. Manual: start with `pnpm dev:api`, confirm health check works, kill with Ctrl+C and observe graceful shutdown log
4. Manual: set an invalid `API_PORT=abc` and confirm the server refuses to start with a clear Zod error
