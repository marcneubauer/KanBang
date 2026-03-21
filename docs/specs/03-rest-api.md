# KanBang — REST API Specification

## Base URL

```
/api/v1
```

## Authentication

All endpoints except auth registration/login require a valid session cookie (`kanbang_session`). Unauthenticated requests receive `401 Unauthorized`.

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

### GET /api/v1/auth/me

Returns the currently authenticated user.

**Response (200):**
```json
{
  "user": { "id": "abc123", "email": "user@example.com", "username": "alice" }
}
```

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
        "archivedAt": null,
        "cards": [
          {
            "id": "card1",
            "title": "First task",
            "description": null,
            "position": "a0",
            "completed": false,
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

Update a board's name.

**Request:**
```json
{ "name": "Updated Board Name" }
```

**Response (200):** Updated board object (same shape as POST response)

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

Update a list's name.

**Request:**
```json
{ "name": "In Progress" }
```

**Response (200):** Updated list object

### PATCH /api/v1/lists/:listId/reorder

Update a list's position (used after drag-and-drop).

**Request:**
```json
{ "position": "aN" }
```

**Response (200):** Updated list object

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
  "description": "Optional description"
}
```

**Validation:**
- `title`: 1-500 chars, trimmed
- `description`: optional, max 5000 chars
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
    "archivedAt": null,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Errors:** `404 NOT_FOUND`

### PATCH /api/v1/cards/:cardId

Update a card's title, description, and/or completed status.

**Request:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "completed": true
}
```

All fields are optional. At least one must be provided.

**Validation:**

- `title`: 1-500 chars, trimmed (optional)
- `description`: max 5000 chars, nullable (optional)
- `completed`: boolean (optional)

**Response (200):** Updated card object

### PATCH /api/v1/cards/:cardId/move

Move or reorder a card. Handles both within-list reordering and cross-list moves.

**Request:**
```json
{
  "listId": "list2",
  "position": "aN"
}
```

- `listId`: target list (same list = reorder, different list = move)
- `position`: new fractional index position

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
