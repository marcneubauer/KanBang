# Plan — Card Image Attachments, Local Image Hosting & Board Image Backgrounds

**Status:** planned, not started. Dex: GH-24 (attachments) + subtasks.
**Written:** 2026-07-19. Read this whole file before starting; it encodes repo tripwires that will otherwise cost you an hour each.

## Goal

1. Upload images and attach them to cards; attachment images can be the card **cover** so they show on the mini-card in the list view.
2. Upload an image as a **board background** (third option beside color/gradient).
3. Images are stored **locally** (the app ultimately runs in Docker on a NAS), are covered by the existing backup story, and are exportable.

Out of scope for v1 (noted for later): arbitrary non-image file attachments, URL-only attachments, downloading attachments during Trello import.

## Storage decision (settled — don't relitigate)

**Files live on the filesystem; SQLite stores metadata only.**

- Uploads go under `UPLOADS_DIR` (new env var). **Default it to a sibling of the DB file**: in Docker, `/app/packages/api/data/uploads`, which is inside the existing `db-data` volume. That means the single existing volume holds DB + images → one thing to back up / cloud-sync / bind-mount to a NAS-synced folder. This is the whole backup story and it's why we're not adding a second volume or an object store.
- Dev default: `packages/api/data/uploads` (gitignore `packages/api/data/`). Tests: point `UPLOADS_DIR` at a per-run temp dir.
- Rejected alternative: BLOBs in SQLite. Keeps one store and makes export trivial, but bloats the DB file, makes every image write churn the whole DB file for file-level sync tools (Syncthing/cloud sync re-uploads the entire DB), and streaming range responses get awkward. Filesystem + metadata wins for a NAS deployment.
- Flat directory, no sharding: files stored as `<attachmentId>.<ext>` (+ `<attachmentId>.thumb.webp`). A personal instance won't hit directory-size limits. `storage_key` in the DB is the filename only — **never build a path from user input**; always look up the row by id, then join `UPLOADS_DIR + storage_key`.

## Data model

One new table serves both card attachments and board background images:

```ts
// packages/api/src/db/schema/attachments.ts
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(),                       // nanoid
  userId: text('user_id').notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  cardId: text('card_id')                            // NULL ⇒ board-background image
    .references(() => cards.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),              // original upload name, display only
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  storageKey: text('storage_key').notNull(),         // '<id>.<ext>'
  thumbKey: text('thumb_key'),                       // '<id>.thumb.webp' when generated
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

- `userId` FK is safe (attachments→users doesn't create the users→lists→boards→users cycle documented in users.ts).
- Extensionless imports in schema files (drizzle-kit CJS), add to barrel `schema.ts` with `.js` extension — follow the existing pattern.
- Migration via `pnpm db:generate` from repo root (Node 25: `source ~/.nvm/nvm.sh && nvm use` first). Next free migration number is 0016.

**Cover linkage:** extend `cards.coverType` enum `'color' | 'image'` → add `'attachment'`; `coverValue` holds the attachment id. Keep `'image'` for external URLs (already shipped). On attachment delete, clear any cover pointing at it (`UPDATE cards SET cover_type=NULL, cover_value=NULL WHERE cover_type='attachment' AND cover_value=?`).

**Board background linkage:** extend `boards.backgroundType` enum `'color' | 'gradient'` → add `'image'`; `backgroundValue` holds the attachment id (a row with `cardId: null`). Add `boards.backgroundAccent` (text, nullable): for image backgrounds the accent can't be derived in shared code, so compute it at upload (sharp `stats().dominant`) and store it; `resolveBoardAccent` falls back to `#344563` when null.

**Orphan files:** DB cascades delete attachment *rows* when a card/list/board dies, but nobody unlinks the *files*. Handle it in two layers:
1. Service-level: in CardService.delete, ListService.delete, BoardService.delete (and the archive-purge path in board.service), collect `storage_key`/`thumb_key` for affected attachments **before** the delete, unlink after the transaction commits. Board delete must also clean its background attachment.
2. Safety net: `FileStorageService.gc()` — list `UPLOADS_DIR`, delete files whose id has no DB row. Run it on API startup (cheap at personal scale). Never run it mid-upload race: only gc files older than ~1h mtime.

## Upload pipeline

- `@fastify/multipart` registered in app.ts, `limits: { fileSize: config.uploads.maxBytes }` — new env `UPLOAD_MAX_BYTES`, default 10 MiB (413 on exceed).
- **Validate by magic bytes**, not the client's claimed type: `file-type` package (ESM-only — fine, the API runs ESM via tsx/node). Allowlist: png, jpeg, webp, gif, avif. Reject others with 400 `UNSUPPORTED_FILE_TYPE`.
- Stream to `UPLOADS_DIR/<id>.<ext>.part`, then rename to final name (no half-written files served).
- `sharp` for: dimensions probe; thumbnail `<id>.thumb.webp` (resize to 480px wide, `withoutEnlargement`, quality ~80) — mini-cards render many covers, don't ship originals to the grid; dominant color for board-background accent. **sharp is a native dep → add to `onlyBuiltDependencies` in pnpm-workspace.yaml**, and add it with `pnpm --filter @kanbang/api add sharp` **from the repo root** (never cd into the package — see CLAUDE.md lockfile warning).

## API endpoints

All cookie-auth via `requireAuth` except as noted. Ownership: every handler resolves the attachment/card/board and 404s if it isn't the session user's (existing pattern).

| Endpoint | Behavior |
|---|---|
| `POST /api/v1/cards/:id/attachments` | multipart, one file field; creates row + files; returns attachment object (201) |
| `GET /api/v1/cards/:id/attachments` | list, newest first |
| `DELETE /api/v1/attachments/:id` | removes row + files, clears covers referencing it |
| `GET /api/v1/files/:id` | streams original; `Content-Type` from DB, `Content-Disposition: inline; filename="..."`, `Cache-Control: private, max-age=31536000, immutable` (content never changes for a given id), `X-Content-Type-Options: nosniff` |
| `GET /api/v1/files/:id/thumb` | streams thumb; falls back to original when `thumbKey` null |
| `POST /api/v1/boards/:id/background` | multipart; creates `cardId: null` attachment, sets `backgroundType='image'`, `backgroundValue=<id>`, computes+stores `backgroundAccent`; deletes the previous background attachment (row + files) if there was one |
| `DELETE /api/v1/boards/:id/background` | clears background fields, deletes the attachment |

Notes:
- `<img>` tags hit `/api/v1/files/...` same-origin through the SvelteKit proxy, so the session cookie rides along automatically — no signed URLs needed.
- Use `reply.send(fs.createReadStream(...))` — do not read whole files into memory.
- PATCH card validation: extend the cover superRefine in `packages/shared/src/validation/card.ts` — for `coverType: 'attachment'`, `coverValue` must be a nonempty string (existence + ownership checked in the service, 400 if the attachment isn't on that card).

## ⚠️ Repo tripwires (each of these will silently break things)

1. **Serialization schemas strip unknown fields.** Every new response field must be added to `packages/api/src/schemas/index.ts` ($id: card gets nothing new here, but a new `attachment` $id schema is needed) **and** the inline schemas in `routes/boards/index.ts` / `routes/lists/index.ts` if the field rides on board/list GET payloads (`attachmentCount` will — see below). Forgetting this = field silently missing in responses while tests that use the service directly still pass.
2. **The SvelteKit proxy corrupts binary uploads today.** `hooks.server.ts` `proxyToApi` forwards bodies via `await event.request.text()` — UTF-8 decoding mangles multipart image bytes. Change it to pass `event.request.body` (the stream) straight through (`duplex: 'half'` is already set). Response side already streams `response.body`, so image *downloads* through the proxy are fine as-is. Update `hooks.server.test.ts` accordingly.
3. **`attachmentCount` on cards** (for the paperclip badge): follow the exact `commentCount` pattern in `board.service.ts` (set-based groupBy aggregation, see `commentCountByCard`), add to `CardWithProgress` type — **and update the fixture in `card-filter.test.ts`**, which breaks web typecheck every time `CardWithProgress` gains a required field.
4. Fastify route with multipart: skip the JSON body schema for those routes (multipart isn't JSON-validated); still declare response schemas.
5. Rate limiting: reuse the existing per-route `rateLimit` config pattern if desired (uploads: something like 60/min is plenty).

## Web UI

- **CardDetailModal** — new "Attachments" section: file input + drag-drop onto the section; rows of thumbnail / filename / size / date; per-row actions: *Make cover* (PATCH card `coverType:'attachment'`), *Delete*. The existing Cover section gains the attachment option (show current attachment thumbs to pick from). `api.ts` needs no changes for FormData — it only forces JSON Content-Type for string bodies — just pass a `FormData` body.
- **BoardCard** (mini-card) — cover strip already renders for `coverType 'color' | 'image'`; add `'attachment'` → `/api/v1/files/<id>/thumb`. Add paperclip badge with `attachmentCount` (same style as the comment badge).
- **BoardSettingsModal** — Background section gains an "Image" tab: upload button, current-image preview, remove. Board page background: extend `resolveBoardBackground` in `packages/shared/src/background-presets.ts` — `'image'` → `url(/api/v1/files/<value>)`; board page needs `background-size: cover; background-position: center` for the image case.

Svelte 5 runes only (`$state`, `$derived`, `$props`); `onclick={...}` handlers, not `on:click`.

## Export & backup

- **Primary backup = the data directory.** DB + `uploads/` share `db-data`; document in README (Deployment + Environment Variables: add `UPLOADS_DIR`, `UPLOAD_MAX_BYTES`) and docker-compose (`UPLOADS_DIR=/app/packages/api/data/uploads`). Mention NAS users can bind-mount that path into a synced share.
- `GET /api/v1/export` (JSON): add `attachments` metadata per card and board `backgroundImage` metadata (id, filename, mime, size — not the bytes).
- `GET /api/v1/export/archive`: streamed zip of `export.json` + `files/<storage_key>` for every attachment. Use `yazl` (small, stream-friendly). This is also most of GH-23 — check dex before duplicating work.

## Docs (same-change rule from CLAUDE.md)

Update in the same commits: `docs/FEATURES.md` (Attachments + board image background sections, UI locations, endpoints), `docs/specs/03-rest-api.md` (new endpoints + attachment object in the Object Field Reference; note the two enum extensions), `docs/specs/02-database-schema.md` (attachments table → 13 tables; also bump the "12 tables" claims in CLAUDE.md and specs), README highlights.

## Testing

Integration tests (`packages/api/tests/integration/attachments.test.ts`), using `form-auto-content` (or hand-built multipart payload) with `app.inject()`; `UPLOADS_DIR` → per-test temp dir, cleaned in afterEach:
- upload → 201, file + thumb exist on disk, dimensions recorded
- magic-byte rejection (rename a .txt to .png), size limit 413, unauth 401, other user's card 404
- delete → row gone, files gone, cover cleared
- card/board delete → files unlinked (service path) ; gc() removes a planted orphan
- board background set → replaces + deletes previous; appears in board GET (serialization check!)
- export JSON includes metadata; archive zip contains the file
- proxy: hooks.server.test.ts binary body passthrough

## Suggested phase split (mirrors dex subtasks)

1. **Storage infra & card attachments API** — env/config, table + migration 0016, multipart, FileStorageService (store/delete/gc), sharp, card attachment CRUD + files routes, proxy binary fix, tests.
2. **Card UI + covers** — modal section, cover integration end-to-end, attachmentCount badge, docs.
3. **Board image backgrounds** — enum + accent column + migration, background endpoints, settings Image tab, shared resolver, docs.
4. **Export & backup integration** — export JSON metadata, zip archive endpoint, compose/README/env docs, startup gc.

Commit per phase; `pnpm test` + `pnpm typecheck` green before each commit.
