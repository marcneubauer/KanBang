# Session Log — 2026-07-19 20:50

## Goal

Implement GH-24 (card image attachments + local image hosting) and GH-64 (dark mode & app theming) following the plans in `docs/plans/image-attachments.md` and `docs/plans/dark-mode.md`, one commit per dex phase subtask.

## Tasks Completed

| Phase | Commit | Summary |
|-------|--------|---------|
| GH-24 P1 storage infra & API | `4841b01` | `attachments` table (migration 0016), FileStorageService (magic-byte validation, sharp 480px WebP thumbs, atomic writes, startup gc), card attachment CRUD + `/files/:id(/thumb)` streaming with immutable cache headers, uploads plugin (`UPLOADS_DIR` beside the DB), **proxy binary-body fix** (`request.text()` → stream passthrough) |
| GH-24 P2 UI & covers | `9b9c021` | Modal Attachments section (picker + drag-drop, Make cover/Delete), `coverType 'attachment'` end-to-end with server-side `INVALID_COVER` check, BoardCard thumb covers, `attachmentCount` aggregation + paperclip badge; copies drop attachment covers |
| GH-24 P3 board image backgrounds | `4573d01` | `backgroundType 'image'` + `background_accent` (migration 0017), `POST/DELETE /boards/:id/background` with replace/PATCH-away file cleanup, settings Image tab, resolvers return cover-sized url + dominant-color accent. Drive-by fix: `BoardService.update` never persisted `isTemplate` |
| GH-24 P4 export & backup | `598b56d` | Export JSON gains attachments + backgroundImage metadata; `GET /export/archive` streams a yazl zip (export.json + files/); compose `UPLOADS_DIR` inside the `db-data` volume = single-volume backup; README backup notes |
| GH-64 P1 token sweep | `0161eda` | app.css palette expanded (surface-raised/input-bg/column/frost/hover/overlay/muted/status/aging/shadows); 95+ hardcoded declarations across 15 components tokenized, light mode pixel-equivalent |
| GH-64 P2 theme infra | `4199382` | `users.theme` (migration 0018), `PATCH /auth/me`, no-FOUC SSR (`data-theme` placeholder + pre-paint inline script + `transformPageChunk`), live OS tracking in system mode, Settings → Appearance radios + localStorage mirror |
| GH-64 P3 dark palette | `52456c6` | `:root[data-theme='dark']` block (`color-scheme: dark`), dark nav surface override, dark-tuned frost/aging/status/template tokens; board accent precedence preserved |

GH-24 closed in dex (all 4 subtasks). GH-64: phases 1–3 closed; only the stretch subtask (custom app-shell background, `mmdkpv2w`) remains open.

## Key Decisions

- Endpoint for theme is `PATCH /api/v1/auth/me` (matches the existing `GET /auth/me`), not the plan's `/users/me`.
- Attachment covers reference attachment ids; copies drop them (attachments are card-bound, never duplicated). Cross-board moves keep attachments.
- No hard-delete routes exist for cards/lists/boards (archive-only app), so file cleanup lives on the attachment/background endpoints + a startup gc sweep (>1h mtime guard).
- Board background replacement/PATCH-away deletes the old image file inline in the routes.
- Kept literal in the token sweep (intentional): white text on colored chips/buttons, translucent-white header controls over accent backgrounds, SVG state colors.
- Accidental find: two stray `.dex/* 2.json` Finder-duplicate files (stale snapshots from Jul 18) briefly got committed and were amended out — they remain untracked on disk; consider deleting them.

## State at Session End

- Suite: 26 files / 339 tests green; typecheck clean at every commit.
- Dev server restarted (the earlier one had died) and verified: login page SSRs `data-theme`, pre-paint script present, API healthy with migrations 0016–0018 applied.
- Visual QA of the dark palette by eye is still worth a pass (label chips, aging fades, gradient boards) — values are Trello-adjacent and easy to tune in `app.css`.
