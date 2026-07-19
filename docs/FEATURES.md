# KanBang Feature Guide

What KanBang can do, where each feature lives in the UI, and the API behind it. Written for both people and agents — the full endpoint reference with request/response shapes is in [specs/03-rest-api.md](specs/03-rest-api.md).

> **Maintenance rule:** when a feature is added or changed, update this file and the API spec in the same change.

## Core

| Feature | UI | API |
|---------|----|----|
| Boards, lists, cards (CRUD) | Boards page; board page | `/boards`, `/boards/:id/lists`, `/lists/:id/cards` |
| Drag-and-drop reordering | Drag lists/cards (mouse); card modal "Move" is the keyboard path | `PATCH /lists/:id/reorder`, `PATCH /cards/:id/move` (fractional-index positions) |
| Archive instead of delete | Hover a list/card → archive icon; board settings → Danger zone; Archived panel restores | `PATCH .../archive`, `.../unarchive`, `GET /boards/:id/archived` |
| Undo | Toast with Undo after archiving a list/card | client-side unarchive call |

## Cards

- **Card numbers** — every card gets a board-scoped auto-increment (#1, #2… like GitHub issues), shown on the card face. Numbers are never reused; cross-board moves renumber from the target board. Field: `card.number`.
- **Completed checkbox + Done list** — checking a card timestamps it and auto-moves it to the board's designated Done list (board settings → Done list). Done-list cards completed 3+ days ago auto-archive. `PATCH /cards/:id { completed }`, `PATCH /lists/:id/done`.
- **Due dates** — calendar icon on the card face or the modal; overdue/soon states color the badge. `dueDate` field.
- **Descriptions with markdown** — card modal; rendered with sanitized markdown.
- **Checklists** — card modal; progress badge on the card face; items can convert to cards. `/cards/:id/checklists`, `/checklists/...`, `POST /checklist-items/:id/convert-to-card`.
- **Labels** — board-scoped colored tags; managed in the card modal, filterable from the board header. `/boards/:id/labels`, `/cards/:id/labels/:labelId`.
- **Comments** — markdown comments in the card modal, newest first, editable/deletable; count badge on the card face. `/cards/:id/comments`, `/comments/:id`.
- **Covers** — solid color or external image URL, set in the card modal; board settings can hide all covers ("Card covers"). `coverType`/`coverValue` via `PATCH /cards/:id`; board `coversEnabled`.
- **Templates** — mark a card as a template in its modal; the list's add-card form then offers "From template" chips. Creating from a template is a copy — the result is a normal card. `isTemplate` via `PATCH /cards/:id`; creation via `POST /cards/:id/copy`.
- **Copy / move across boards** — card modal "Move" (board + list + position) and "Copy" (keep checklists/labels). Labels don't survive board crossings. `POST /cards/:id/copy`, `PATCH /cards/:id/move`.
- **Quick edit** — pencil icon on the card face for title/labels/due date without opening the modal.
- **Card aging** — board setting; cards untouched past the threshold fade progressively (completed/Done cards exempt). Board `cardAgingDays`.

## Lists

- **Sort** — list header menu: name A–Z, due date (undated last), newest/oldest first. Persists via `PATCH /lists/:id/sort`.
- **WIP limits** — list header menu → Card limit; count/limit badge turns red when exceeded (advisory only). `cardLimit` via `PATCH /lists/:id`.
- **Collapse** — collapse button in the header; collapsed lists render as vertical strips (state in localStorage; Done lists default collapsed).
- **Copy** — list header menu; duplicates the list with cards, labels, and checklists on the same board. `POST /lists/:id/copy`.
- **Move to board** — list header menu; sends the list and its cards to another board (labels dropped, Done status reset, cards renumbered). `PATCH /lists/:id/move-to-board`.
- **Done list** — one per board (board settings); see Completed checkbox above.

## Boards

- **Backgrounds** — board settings → Background: solid color or 10 gradient presets; columns go frosted, header text flips white. `backgroundType`/`backgroundValue`.
- **Color theme** — buttons and header controls take an accent derived from the background; new labels default to the accent when it's in the palette.
- **Search & filters** — board header: text search, label chips, due-date filter; non-matching cards dim. Server search: `GET /boards/:id/cards/search`.
- **Board templates** — *partial*: `isTemplate` exists on boards; duplicate-from-template flow is not built yet (GH-27).

## Getting data in and out

- **Trello import** — Settings → "Import from Trello": upload a per-board JSON export; lists/cards/labels/due dates/checklists/archived state preserved. `POST /api/v1/import/trello`.
- **JSON export** — Settings → "Export data": everything (including archived items and comments) as one JSON file. `GET /api/v1/export`.
- **Quick add (Shortcuts / Apple Watch)** — Settings → "Quick add": pick a default list and generate a bearer token, then `POST /api/v1/quick-add` with `{"text": "..."}` and `Authorization: Bearer kb_...` creates a card. A "Board name: title" prefix targets that board instead. Built for iOS/watchOS Shortcuts dictation; works from any script.

## Account & security

- **Auth** — email+password (argon2id) and passkeys/WebAuthn; cookie sessions with 30-day sliding expiry; rate-limited auth endpoints; generic login/register errors (anti-enumeration).
- **Change password** — Settings; signs out all other sessions. `POST /auth/change-password`.
- **Quick-add token** — sha256-hashed at rest, shown once, rotate/revoke in Settings.

## For agents

- Base URL `/api/v1`, cookie auth (`kanbang_session`) everywhere except `POST /quick-add` (bearer). Full endpoint reference: [specs/03-rest-api.md](specs/03-rest-api.md) — includes an "Object Field Reference" section with canonical field lists.
- Useful read endpoints for tool use: `GET /boards` (all boards), `GET /boards/:id` (full board with cards, labels, checklist progress, comment counts), `GET /lists/:id`, `GET /cards/:id`, `GET /boards/:id/cards/search?q=...`.
- Positions are fractional-index strings — to reorder, compute a key between neighbors (see `@kanbang/shared` `generateKeyBetween`); never renumber siblings.
