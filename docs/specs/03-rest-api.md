# KanBang — REST API Specification

## Base URL

```
/api/v1
```

## Authentication

All endpoints except auth registration/login require a valid session cookie (`kanbang_session`). Unauthenticated requests receive `401 Unauthorized`.

**Exception:** `POST /api/v1/quick-add` authenticates with a per-user bearer token (`Authorization: Bearer kb_...`) instead of a cookie, so it can be called from iOS/watchOS Shortcuts and other scripts. See [Quick Add](#quick-add).

## Object Field Reference

Canonical field lists for the core objects. (Older JSON samples below may omit newer fields; the serialized responses always include all of them.)

**Board** — `id`, `name`, `userId`, `cardAgingDays` (int days or null; cards untouched this long render faded), `coversEnabled` (bool, default true), `isTemplate` (bool), `backgroundType` (`"color"` | `"gradient"` | `"image"` | null), `backgroundValue` (hex color, gradient preset id, or attachment id), `backgroundAccent` (dominant-color hex derived at upload for image backgrounds; null otherwise), `createdAt`, `updatedAt`, `archivedAt`. Image backgrounds are set only via `POST /boards/:id/background` (PATCH accepts `color`/`gradient`/null).

**List** — `id`, `name`, `boardId`, `position` (fractional-index string), `isDone` (bool; completed cards auto-move here), `cardLimit` (int WIP limit or null; advisory), `createdAt`, `updatedAt`, `archivedAt`.

**Card** — `id`, `number` (board-scoped auto-increment like GitHub issues; null only for pre-migration rows), `title`, `description`, `listId`, `position`, `completed`, `isTemplate` (bool), `coverType` (`"color"` | `"image"` | `"attachment"` | null), `coverValue` (hex color, http(s) image URL, or attachment id — the attachment must be on the same card), `completedAt`, `dueDate`, `createdAt`, `updatedAt`, `archivedAt`. Cards inside the board-detail response additionally carry `checklistProgress` (`{total, completed}`), `labelIds` (string array), `commentCount` (int), and `attachmentCount` (int). Copies drop attachment covers (attachments are not copied).

**Label** — `id`, `name`, `color` (hex), `boardId`, `createdAt`, `updatedAt`.

**Comment** — `id`, `body` (markdown), `cardId`, `createdAt`, `updatedAt`.

**Attachment** — `id`, `cardId` (null for board-background images), `filename` (original upload name), `mimeType`, `sizeBytes`, `width`/`height` (int px or null), `createdAt`. Internal storage keys are never exposed; fetch the bytes via `GET /api/v1/files/:id`.

## Error Response Format

All error responses follow this shape:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {}
}
```

Common error codes:
- `VALIDATION_ERROR` — request body failed Zod validation (details contains field errors)
- `UNAUTHORIZED` — no valid session
- `FORBIDDEN` — authenticated but not authorized for this resource
- `NOT_FOUND` — resource does not exist
- `CONFLICT` — resource already exists (e.g., duplicate email)

---

## Health

### GET /api/v1/health

Returns server health status. No authentication required.

**Response (200):**
```json
{ "status": "ok" }
```

---

## Auth Endpoints

### POST /api/v1/auth/register

Register a new user with email and password.

**Request:**
```json
{
  "email": "user@example.com",
  "username": "alice",
  "password": "securepassword123"
}
```

**Validation:**
- `email`: valid email format, max 255 chars
- `username`: 3-30 chars, alphanumeric + hyphens + underscores
- `password`: 8-128 chars

**Response (201):**
```json
{
  "user": { "id": "abc123", "email": "user@example.com", "username": "alice" }
}
```
Sets `kanbang_session` cookie.

**Errors:** `409 CONFLICT` (email or username taken), `400 VALIDATION_ERROR`

### POST /api/v1/auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": { "id": "abc123", "email": "user@example.com", "username": "alice" }
}
```
Sets `kanbang_session` cookie.

**Errors:** `401 UNAUTHORIZED` (invalid credentials)

### POST /api/v1/auth/logout

Destroys the current session. Requires authentication.

**Response (200):**
```json
{ "ok": true }
```

### POST /api/v1/auth/change-password

Change the authenticated user's password after verifying the current one. Invalidates all other sessions. Rate limited.

**Request:**
```json
{ "currentPassword": "old-password", "newPassword": "new-password-12chars+" }
```

**Response (200):** `{ "ok": true }` — `400 INVALID_PASSWORD` when the current password is wrong

### GET /api/v1/auth/me

Returns the currently authenticated user.

**Response (200):**
```json
{
  "user": { "id": "abc123", "email": "user@example.com", "username": "alice", "theme": "system" }
}
```

### PATCH /api/v1/auth/me

Update user preferences. Currently accepts `{ "theme": "light" | "dark" | "system" }` (the UI theme, applied on every device the user signs in from).

**Response (200):** the updated user object — **Errors:** `400 VALIDATION_ERROR`

---

## Passkey Endpoints

### GET /api/v1/passkeys

List the authenticated user's passkeys.

**Response (200):**
```json
{
  "passkeys": [
    {
      "id": "cred123",
      "deviceType": "multiDevice",
      "backedUp": true,
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

### POST /api/v1/passkeys/register/options

Get WebAuthn registration options. Requires authentication.

**Response (200):** SimpleWebAuthn `PublicKeyCredentialCreationOptionsJSON`

### POST /api/v1/passkeys/register/verify

Verify WebAuthn registration. Requires authentication.

**Request:** SimpleWebAuthn `RegistrationResponseJSON`

**Response (200):**
```json
{ "verified": true }
```

### POST /api/v1/passkeys/login/options

Get WebAuthn authentication options. No auth required.

**Request (optional):**
```json
{ "email": "user@example.com" }
```

**Response (200):** SimpleWebAuthn `PublicKeyCredentialRequestOptionsJSON`

### POST /api/v1/passkeys/login/verify

Verify WebAuthn authentication. No auth required.

**Request:** SimpleWebAuthn `AuthenticationResponseJSON`

**Response (200):**
```json
{
  "user": { "id": "abc123", "email": "user@example.com", "username": "alice" }
}
```
Sets `kanbang_session` cookie.

### DELETE /api/v1/passkeys/:credentialId

Delete a passkey. Requires authentication. User can only delete their own passkeys.

**Response (200):**
```json
{ "ok": true }
```

---

## Board Endpoints

All require authentication. Users can only access their own boards.

### GET /api/v1/boards

List boards for the authenticated user.

**Query parameters:**

- `archived` (optional): `true` to return only archived boards. Omit or `false` for active boards only.

**Response (200):**
```json
{
  "boards": [
    {
      "id": "board1",
      "name": "My Board",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "archivedAt": null
    }
  ]
}
```

### POST /api/v1/boards

Create a new board.

**Request:**
```json
{ "name": "My Board" }
```

**Validation:** `name`: 1-100 chars, trimmed

**Response (201):**
```json
{
  "board": {
    "id": "board1",
    "name": "My Board",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "archivedAt": null
  }
}
```

### GET /api/v1/boards/:boardId

Get a board with all its lists and cards, sorted by position.

Only active lists (not archived) and active cards (not archived) are included.

**Response (200):**
```json
{
  "board": {
    "id": "board1",
    "name": "My Board",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "archivedAt": null,
    "lists": [
      {
        "id": "list1",
        "name": "To Do",
        "position": "a0",
        "isDone": false,
        "archivedAt": null,
        "cards": [
          {
            "id": "card1",
            "title": "First task",
            "description": null,
            "position": "a0",
            "completed": false,
            "completedAt": null,
            "dueDate": null,
            "checklistProgress": null,
            "archivedAt": null
          }
        ]
      }
    ]
  }
}
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### PATCH /api/v1/boards/:boardId

Update a board's name and/or settings. All fields optional.

**Request:**
```json
{
  "name": "Updated Board Name",
  "cardAgingDays": 14,
  "coversEnabled": true,
  "isTemplate": false,
  "backgroundType": "gradient",
  "backgroundValue": "ocean"
}
```

**Validation:**

- `name`: 1-100 chars, trimmed
- `cardAgingDays`: integer 1-365 or `null` (off)
- `coversEnabled`: boolean — hide/show all card covers on this board
- `isTemplate`: boolean
- `backgroundType` + `backgroundValue` must be sent together: `"color"` requires a `#rrggbb` hex value; `"gradient"` requires a preset id (`ocean`, `sunset`, `forest`, `lavender`, `flamingo`, `midnight`, `aqua`, `citrus`, `mint`, `slate`); `null`/`null` clears the background. Setting these while an image background is active also deletes the stored image.

**Response (200):** Updated board object (same shape as POST response)

### POST /api/v1/boards/:boardId/background

Upload an image board background as `multipart/form-data` (same constraints as card attachments: PNG/JPEG/WebP/GIF/AVIF by magic bytes, `UPLOAD_MAX_BYTES` limit). Stores the file as a board-scoped attachment (`cardId: null`), sets `backgroundType: "image"` with the attachment id as `backgroundValue`, and derives `backgroundAccent` from the image's dominant color. Replacing an existing image background deletes the previous file.

**Response (200):** `{ "board": { …board fields } }` — **Errors:** `400 NO_FILE` / `400 UNSUPPORTED_FILE_TYPE`, `413`

### DELETE /api/v1/boards/:boardId/background

Clear the board background (any type). For image backgrounds this also deletes the stored file. **Response (200):** `{ "board": … }`

### GET /api/v1/boards/:boardId/cards/search

Search cards across all lists in a board. Supports text search and completed status filtering.

**Query parameters:**

- `q` (optional): case-insensitive text search in title and description
- `completed` (optional): `true` or `false` to filter by completed status

**Response (200):**
```json
{
  "cards": [
    {
      "id": "card1",
      "title": "Deploy to prod",
      "description": "Ship the new release",
      "listId": "list2",
      "listName": "In Progress",
      "position": "a0",
      "completed": false,
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z"
    }
  ]
}
```

Note: includes `listName` so consumers can contextualize which list each card belongs to without extra lookups. Returns an empty array if no cards match.

**Errors:** `404 NOT_FOUND` (board doesn't exist), `403 FORBIDDEN`

### PATCH /api/v1/boards/:boardId/archive

Archive a board. The board will no longer appear in the active boards list. Its lists and cards are unaffected (their own `archivedAt` states are unchanged).

**Response (200):**
```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### PATCH /api/v1/boards/:boardId/unarchive

Restore an archived board to the active boards list.

**Response (200):**
```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### GET /api/v1/boards/:boardId/archived

Get all archived items within a board: archived lists (with their cards) and archived cards from active lists.

**Response (200):**
```json
{
  "archivedLists": [
    {
      "id": "list1",
      "name": "Old Column",
      "position": "a0",
      "archivedAt": "2025-03-01T12:00:00.000Z",
      "cards": [
        {
          "id": "card1",
          "title": "Some task",
          "completed": false,
          "archivedAt": null
        }
      ]
    }
  ],
  "archivedCards": [
    {
      "id": "card2",
      "title": "Archived task",
      "listId": "list2",
      "listName": "In Progress",
      "position": "a0",
      "completed": false,
      "archivedAt": "2025-03-10T09:00:00.000Z"
    }
  ]
}
```

- `archivedLists`: lists in this board where `archivedAt IS NOT NULL`, each including all their cards (regardless of those cards' `archivedAt`)
- `archivedCards`: cards where `archivedAt IS NOT NULL` that belong to lists that are **not** archived

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

---

## List Endpoints

All require authentication. Authorization checked via board ownership.

### POST /api/v1/boards/:boardId/lists

Create a new list at the end of the board.

**Request:**
```json
{ "name": "To Do" }
```

**Validation:** `name`: 1-100 chars, trimmed

**Response (201):**
```json
{
  "list": {
    "id": "list1",
    "name": "To Do",
    "boardId": "board1",
    "position": "a0",
    "isDone": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "archivedAt": null
  }
}
```

Position is automatically calculated as after the last existing active list.

### GET /api/v1/lists/:listId

Get a single list with its cards, sorted by position.

Only active cards (not archived) are included.

**Response (200):**
```json
{
  "list": {
    "id": "list1",
    "name": "To Do",
    "boardId": "board1",
    "position": "a0",
    "isDone": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z",
    "archivedAt": null,
    "cards": [
      {
        "id": "card1",
        "title": "First task",
        "description": null,
        "position": "a0",
        "completed": false,
        "completedAt": null,
        "dueDate": null,
        "archivedAt": null,
        "createdAt": "2025-01-15T10:30:00.000Z",
        "updatedAt": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**Errors:** `404 NOT_FOUND`

### PATCH /api/v1/lists/:listId

Update a list's name and/or WIP card limit. Both fields optional.

**Request:**
```json
{ "name": "In Progress", "cardLimit": 5 }
```

**Validation:** `name`: 1-100 chars, trimmed; `cardLimit`: integer 1-999 or `null` to clear. The limit is advisory — the UI turns the count red when exceeded but card creation is never blocked.

**Response (200):** Updated list object

### PATCH /api/v1/lists/:listId/sort

Sort a list's active cards, rewriting their fractional positions in one transaction.

**Request:**
```json
{ "by": "dueDate", "direction": "asc" }
```

**Validation:** `by`: `"name"` | `"dueDate"` | `"createdAt"`; `direction`: `"asc"` (default) | `"desc"`. On due-date sort, cards without a due date always sink to the bottom.

**Response (200):** `{ "cards": [...] }` — the sorted cards with their new positions

### POST /api/v1/lists/:listId/copy

Duplicate a list in place on the same board, appended after its active lists. Copies active cards with their labels and checklists; copied cards get fresh board-scoped numbers. The copy is named `"<name> (copy)"` and is never the Done list.

**Request:** empty body

**Response (201):** `{ "list": {...} }` — the new list (fetch the board for its cards)

### PATCH /api/v1/lists/:listId/move-to-board

Move a list (with its cards) to another owned board, appended after that board's active lists. Label assignments are dropped (labels are board-scoped), cards are renumbered from the target board's sequence, and the Done designation resets.

**Request:**
```json
{ "boardId": "board2" }
```

**Response (200):** `{ "list": {...} }` — the moved list

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN` (list or target board not owned)

### PATCH /api/v1/lists/:listId/reorder

Update a list's position (used after drag-and-drop).

**Request:**
```json
{ "position": "aN" }
```

**Response (200):** Updated list object

### PATCH /api/v1/lists/:listId/done

Designate or un-designate a list as the board's Done list. At most one list per board can be the Done list. Setting `isDone: true` on a list clears `isDone` on any other list in the same board.

**Request:**
```json
{ "isDone": true }
```

**Validation:** `isDone`: boolean (required)

**Response (200):** Updated list object

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### PATCH /api/v1/lists/:listId/archive

Archive a list. The list will no longer appear in its board's active view. Its cards are unaffected.

**Response (200):**
```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### PATCH /api/v1/lists/:listId/unarchive

Restore an archived list to its board's active view.

**Response (200):**
```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

---

## Card Endpoints

All require authentication. Authorization checked via list → board ownership.

### POST /api/v1/lists/:listId/cards

Create a new card at the end of the list.

**Request:**
```json
{
  "title": "My Task",
  "description": "Optional description",
  "dueDate": "2025-06-01T00:00:00.000Z"
}
```

**Validation:**
- `title`: 1-500 chars, trimmed
- `description`: optional, max 5000 chars
- `dueDate`: optional, ISO 8601 date string or null
- `completed`: defaults to `false`

**Response (201):**
```json
{
  "card": {
    "id": "card1",
    "title": "My Task",
    "description": "Optional description",
    "listId": "list1",
    "position": "a0",
    "completed": false,
    "completedAt": null,
    "dueDate": "2025-06-01T00:00:00.000Z",
    "archivedAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

### GET /api/v1/cards/:cardId

Get a single card by ID.

**Response (200):**
```json
{
  "card": {
    "id": "card1",
    "title": "My Task",
    "description": "Task description",
    "listId": "list1",
    "position": "a0",
    "completed": false,
    "completedAt": null,
    "dueDate": null,
    "archivedAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Errors:** `404 NOT_FOUND`

### PATCH /api/v1/cards/:cardId

Update a card's title, description, completed status, due date, template flag, and/or cover.

When `completed` is set to `true`, the server sets `completedAt` to the current time. If a Done list exists for the card's board, the card is automatically moved to it (the response will reflect the new `listId` and `position`). When `completed` is set to `false`, `completedAt` is cleared; the card is **not** auto-moved back.

**Request:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "completed": true,
  "dueDate": "2025-06-01T00:00:00.000Z"
}
```

All fields are optional. At least one must be provided.

**Validation:**

- `title`: 1-500 chars, trimmed (optional)
- `description`: max 5000 chars, nullable (optional)
- `completed`: boolean (optional)
- `dueDate`: ISO 8601 date string, nullable (optional; send `null` to clear)
- `isTemplate`: boolean (optional) — template cards appear as "From template" options in the add-card UI
- `coverType` + `coverValue` (optional, must be sent together): `"color"` requires a `#rrggbb` hex; `"image"` requires an http(s) image URL (max 2000 chars); `"attachment"` requires the id of an attachment on this card (else `400 INVALID_COVER`); `null`/`null` removes the cover

**Response (200):** Updated card object

### POST /api/v1/cards/:cardId/copy

Duplicate a card onto any owned list (same or different board), appended at the end. The copy gets a fresh board-scoped number and is always a normal card (`isTemplate: false`), even when the source is a template — this is also the "create from template" mechanism. Covers are preserved.

**Request:**
```json
{ "listId": "list2", "keepChecklists": true, "keepLabels": true }
```

**Validation:** `listId`: required; `keepChecklists`/`keepLabels`: booleans, default `true`. Labels only survive same-board copies (they're board-scoped) — `keepLabels` is ignored across boards.

**Response (201):** `{ "card": {...} }` — the new card

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN` (card or target list not owned)

### PATCH /api/v1/cards/:cardId/move

Move or reorder a card. Handles both within-list reordering and cross-list moves.

**Request:**
```json
{
  "listId": "list2",
  "position": "aN"
}
```

- `listId`: target list (same list = reorder, different list = move; may be on a different owned board)
- `position`: new fractional index position

Cross-board moves drop the card's label assignments (labels are board-scoped) and assign it a fresh number from the target board's sequence.

**Response (200):** Updated card object

### PATCH /api/v1/cards/:cardId/archive

Archive a card. The card will no longer appear in its list's active view.

**Response (200):**
```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### PATCH /api/v1/cards/:cardId/unarchive

Restore an archived card to its list's active view.

**Response (200):**
```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

---

## Checklist Endpoints

All require authentication. Authorization checked via checklist → card → list → board ownership.

### GET /api/v1/cards/:cardId/checklists

Get all checklists for a card, with nested items. Ordered by position.

**Response (200):**

```json
{
  "checklists": [
    {
      "id": "cl1",
      "name": "Pre-launch",
      "cardId": "card1",
      "position": "a0",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-01-15T10:30:00.000Z",
      "items": [
        {
          "id": "cli1",
          "title": "Write tests",
          "checklistId": "cl1",
          "position": "a0",
          "completed": true,
          "createdAt": "2025-01-15T10:30:00.000Z",
          "updatedAt": "2025-01-15T10:30:00.000Z"
        }
      ]
    }
  ]
}
```

### POST /api/v1/cards/:cardId/checklists

Create a new checklist on a card.

**Request:**

```json
{ "name": "Pre-launch" }
```

**Validation:** `name`: 1-100 chars, trimmed

**Response (201):** Checklist object (with empty `items` array)

### PATCH /api/v1/checklists/:checklistId

Update a checklist's name.

**Request:**

```json
{ "name": "Updated name" }
```

**Response (200):** Updated checklist object

### PATCH /api/v1/checklists/:checklistId/reorder

Update a checklist's position within its card.

**Request:**

```json
{ "position": "aN" }
```

**Response (200):** Updated checklist object

### DELETE /api/v1/checklists/:checklistId

Permanently delete a checklist and all its items.

**Response (200):**

```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

---

## Checklist Item Endpoints

All require authentication. Authorization checked via item → checklist → card → list → board ownership.

### POST /api/v1/checklists/:checklistId/items

Create a new item at the end of a checklist.

**Request:**

```json
{ "title": "Write tests" }
```

**Validation:** `title`: 1-500 chars, trimmed

**Response (201):** Checklist item object

### PATCH /api/v1/checklist-items/:itemId

Update an item's title and/or completed status.

**Request:**

```json
{
  "title": "Updated title",
  "completed": true
}
```

All fields optional.

**Response (200):** Updated checklist item object

### PATCH /api/v1/checklist-items/:itemId/reorder

Update an item's position within its checklist.

**Request:**

```json
{ "position": "aN" }
```

**Response (200):** Updated checklist item object

### DELETE /api/v1/checklist-items/:itemId

Permanently delete a checklist item.

**Response (200):**

```json
{ "ok": true }
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

### POST /api/v1/checklist-items/:itemId/convert-to-card

Convert a checklist item into a new card. Creates a card in the specified list using the item's title, then deletes the item.

**Request:**

```json
{ "listId": "list1" }
```

**Validation:** `listId`: non-empty string (must belong to the same board)

**Response (201):**

```json
{
  "card": { "..." : "..." }
}
```

**Errors:** `404 NOT_FOUND`, `403 FORBIDDEN`

---

## Label Endpoints

Labels are board-scoped colored tags assignable to cards.

### GET /api/v1/boards/:boardId/labels

List a board's labels. **Response (200):** `{ "labels": [...] }`

### POST /api/v1/boards/:boardId/labels

Create a label. **Request:** `{ "name": "urgent", "color": "#eb5a46" }` — `name`: max 50 chars (may be empty); `color`: `#rrggbb` hex. **Response (201):** `{ "label": {...} }`

### PATCH /api/v1/labels/:labelId

Update a label's name and/or color (same validation). **Response (200):** `{ "label": {...} }`

### DELETE /api/v1/labels/:labelId

Delete a label and all its card assignments. **Response (200):** `{ "ok": true }`

### POST /api/v1/cards/:cardId/labels/:labelId

Assign a label to a card (label must belong to the card's board). **Response (201):** `{ "ok": true }`

### DELETE /api/v1/cards/:cardId/labels/:labelId

Unassign a label from a card. **Response (200):** `{ "ok": true }`

---

## Comment Endpoints

Markdown-capable comments on cards.

### GET /api/v1/cards/:cardId/comments

List a card's comments, newest first. **Response (200):** `{ "comments": [...] }`

### POST /api/v1/cards/:cardId/comments

Add a comment. **Request:** `{ "body": "Looks **done** to me" }` — 1-5000 chars, trimmed. **Response (201):** `{ "comment": {...} }`

### PATCH /api/v1/comments/:commentId

Edit a comment's body (same validation). **Response (200):** `{ "comment": {...} }`

### DELETE /api/v1/comments/:commentId

Delete a comment. **Response (200):** `{ "ok": true }`

---

## Quick Add

Create cards from external clients (iOS/watchOS Shortcuts, scripts) without a browser session. `POST /api/v1/quick-add` uses a per-user **bearer token**; the four management endpoints use the normal session cookie.

### POST /api/v1/quick-add

Create a card from a text line. Rate limited (default 30/min).

**Headers:** `Authorization: Bearer kb_<token>`

**Request:**
```json
{ "text": "Groceries: buy oat milk" }
```

**Validation:** `text`: 1-500 chars, trimmed.

**Routing:** if the text contains a colon and the prefix case-insensitively matches one of the user's active board names, the card is created on that board's first (leftmost, non-Done) list with the remainder as the title. Otherwise the full text becomes a card on the configured default list.

**Response (201):**
```json
{ "card": { "...": "..." }, "board": "Groceries", "list": "To Buy" }
```

**Errors:** `401 UNAUTHORIZED` (missing/invalid token), `409 QUICK_ADD_NOT_CONFIGURED` (no valid default list and no board-prefix match)

### GET /api/v1/quick-add/config

Current quick-add configuration. **Response (200):** `{ "list": { "listId", "listName", "boardId", "boardName" } | null, "token": { "createdAt", "lastUsedAt" } | null }` — `list` is null when unset or when the configured list was archived/deleted.

### PUT /api/v1/quick-add/config

Set the default target list. **Request:** `{ "listId": "list1" }` (or `null` to clear). Must be an owned list. **Response (200):** `{ "ok": true }`

### POST /api/v1/quick-add/token

Generate (or rotate) the quick-add token. The plaintext is returned **only here** — only a sha256 hash is stored, and any previous token stops working. **Response (201):** `{ "token": "kb_..." }`

### DELETE /api/v1/quick-add/token

Revoke the token. **Response (200):** `{ "ok": true }`

---

## Import

### POST /api/v1/import/trello

Import a Trello per-board JSON export (Trello board menu → "Print, export, and share" → "Export as JSON") as a new board. Body limit 25 MB. Runs in a single transaction.

**Request:** the raw Trello export JSON as the body.

Mapping: lists/cards keep names, descriptions, and `pos` ordering (converted to fractional keys); `closed` items become archived; `due`/`dueComplete` map to due date and completed; checklists and items are preserved; label colors map onto the KanBang palette (`_dark`/`_light` variants collapse to their base); unnamed unused labels are skipped; cards get numbers 1..N.

**Response (201):**
```json
{
  "summary": {
    "boardId": "…", "boardName": "My Trello Board",
    "lists": 5, "cards": 123, "labels": 4, "checklists": 7, "checklistItems": 31
  }
}
```

**Errors:** `400 INVALID_TRELLO_EXPORT`

---

## Attachments

Image files attached to cards, stored on the API host's disk under `UPLOADS_DIR` (metadata in the `attachments` table). Only images are accepted — PNG, JPEG, WebP, GIF, AVIF — validated by magic bytes, not the claimed content type. Max upload size is `UPLOAD_MAX_BYTES` (default 10 MiB). A ≤480px-wide WebP thumbnail is generated automatically for larger images.

### POST /api/v1/cards/:cardId/attachments

Upload one image as `multipart/form-data` (any field name, one file).

**Response (201):** `{ "attachment": { …attachment fields } }`

**Errors:** `400 NO_FILE` (no file part), `400 UNSUPPORTED_FILE_TYPE` (magic bytes not an allowed image), `413` (over size limit)

### GET /api/v1/cards/:cardId/attachments

List a card's attachments, newest first. **Response (200):** `{ "attachments": [ … ] }`

### DELETE /api/v1/attachments/:attachmentId

Delete an attachment: removes the row and the stored files, and clears any card cover that referenced it (`coverType: "attachment"`). **Response (200):** `{ "ok": true }`

### GET /api/v1/files/:attachmentId

Stream the original image bytes (correct `Content-Type`, `Content-Disposition: inline`, `Cache-Control: private, max-age=31536000, immutable` — content for a given id never changes). Owner-only; 404 for other users' files.

### GET /api/v1/files/:attachmentId/thumb

Stream the WebP thumbnail; falls back to the original when no thumbnail was generated (images ≤480px wide).

---

## Export

### GET /api/v1/export

Download all of the authenticated user's boards, lists, cards, checklists, labels, and comments (including archived items) as a JSON file (`Content-Disposition: attachment`). Shape: `{ exportedAt, user, boards: [ { ...board, backgroundImage, labels, lists: [ { ...list, cards: [ { ...card, labelIds, attachments, comments, checklists: [ { ...checklist, items } ] } ] } ] } ] }`. `attachments` and `backgroundImage` are metadata only (including `storageKey`, which names the file inside the archive export below).

### GET /api/v1/export/archive

Streamed zip containing `export.json` (same payload as above) plus every attachment's original file under `files/<storageKey>`. This is a complete portable backup; thumbnails are not included (they regenerate on upload).
