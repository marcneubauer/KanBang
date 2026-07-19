# Session Log — 2026-07-19 08:35

## Goal

Run the dev server for a look at yesterday's feature blitz, then plan two new feature areas in detail — image attachments/hosting and dark mode — landing the plans as docs referenced from dex so a later (Opus) session can implement cold.

## Prompts & Actions

**Prompt 1:** "ok run the dev servber" — started `pnpm dev` in the background (API :3001, web :5173), smoke-tested health endpoint, login page, and quick-add 401. Left running.

**Prompt 2:** Plan card image attachments (visible on mini-cards), image board backgrounds, and dark mode / darker main screen; images will be self-hosted (Docker on NAS) and must be backed up / exportable. Plans go to dex; details too big for dex go into plan files referenced from dex.

**Actions:**

- Grounded the plans in the current code: cover/background enums and superRefine validation, `app.css` token inventory + hardcoded-color counts per component, docker-compose volume layout, export service, hooks proxy, api.ts wrapper.
- **Found a landmine:** the SvelteKit proxy forwards request bodies via `await event.request.text()` — this would corrupt multipart image uploads. The fix (stream passthrough) is specced in the attachments plan Phase 1.
- Wrote [docs/plans/image-attachments.md](../plans/image-attachments.md) — settled storage decision (filesystem under `UPLOADS_DIR` inside the existing `db-data` volume → single-volume backup / cloud-sync story; SQLite metadata only), attachments table schema, upload pipeline (multipart, magic-byte validation, sharp thumbs + dominant-color accents), endpoint table, cover (`coverType 'attachment'`) and background (`backgroundType 'image'`) integration, orphan-file handling, export-zip endpoint, repo tripwires (serialization schemas, proxy fix, card-filter fixture, pnpm root rule), 4-phase split.
- Wrote [docs/plans/dark-mode.md](../plans/dark-mode.md) — token sweep inventory (measured hardcoded-color counts), per-user light/dark/system preference (`users.theme`, `PATCH /users/me`), no-FOUC strategy (SSR `data-theme` via transformPageChunk + inline head script resolving `system`), proposed dark palette, known trouble spots (board accent precedence, label chips, card aging), stretch phase for a customizable app-shell background, 4-phase split.
- Dex: **GH-24** renamed to "Card image attachments + local image hosting" with plan reference + 4 phase subtasks (2–4 blocked by Phase 1). New **GH-64** "Dark mode & app theming" + 4 phase subtasks (2–3 blocked by the token sweep). Both synced to GitHub Issues.

## Files Created or Modified

- `docs/plans/image-attachments.md` (new)
- `docs/plans/dark-mode.md` (new)
- `docs/logs/2026-07-19T08-35_image-and-dark-mode-planning.md` (this file)
- `.dex/` task state (GH-24 edit, GH-64 + 8 subtasks)

## Key Decisions

- **Files on disk, not BLOBs in SQLite** — DB-file churn would make cloud-sync tools re-upload the whole DB on every image; a directory beside the DB inside the same Docker volume keeps backup a single-volume story (the user's preferred "let cloud sync handle it" outcome).
- **One `attachments` table for both card attachments and board background images** (`card_id` nullable), rather than a normalized files+attachments pair — right-sized for a personal instance.
- **Covers reference attachments by id** (`coverType 'attachment'`) instead of reusing `'image'` with an internal URL, so deleting an attachment can deterministically clear covers.
- **v1 scope is images only**; arbitrary files/URL attachments and Trello attachment import are explicitly deferred.
- **Dark mode ships as three ordered phases** with a pure token-sweep refactor first (pixel-identical light mode) so the palette diff stays reviewable; `system` is resolved by an inline pre-paint script, avoiding duplicated media-query token blocks.
