# KanBang — Database Schema

## Entity-Relationship Diagram

```
┌──────────┐     ┌─────────────┐
│  users   │──┐  │ credentials │
│          │  │  │  (passkeys) │
└────┬─────┘  └──┤             │
     │            └─────────────┘
     ├──── sessions
     ├──── api_tokens          (quick-add bearer tokens)
     │
     └──── boards
              ├──── labels ────────────┐
              │                        │
              └──── lists              │
                      │                │
                      └──── cards ─────┤
                               │       │
                               │    card_labels (join)
                               ├──── comments
                               └──── checklists
                                        │
                                        └──── checklist_items
```

All relationships use `ON DELETE CASCADE`. (`users.quick_add_list_id` references a list *without* an FK constraint — see users table note.)

## Tables

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| email | TEXT | NOT NULL, UNIQUE |
| username | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NULLABLE (passkey-only users may not have a password) |
| quick_add_list_id | TEXT | NULLABLE — default target list for quick-add. **No FK** (users → lists would create a schema import cycle); validated at write time, resolved defensively at read time |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |

### credentials (WebAuthn passkeys)

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (credential ID, base64url encoded) |
| user_id | TEXT | NOT NULL, FK → users.id, CASCADE |
| public_key | BLOB | NOT NULL |
| counter | INTEGER | NOT NULL, DEFAULT 0 |
| device_type | TEXT | NOT NULL ('singleDevice' or 'multiDevice') |
| backed_up | INTEGER | NOT NULL, DEFAULT 0 (boolean) |
| transports | TEXT | NULLABLE (JSON array of AuthenticatorTransport) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |

### sessions

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| user_id | TEXT | NOT NULL, FK → users.id, CASCADE |
| expires_at | INTEGER | NOT NULL (Unix timestamp) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |

### boards

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| name | TEXT | NOT NULL |
| user_id | TEXT | NOT NULL, FK → users.id, CASCADE |
| card_aging_days | INTEGER | NULLABLE — cards untouched this many days render faded (null = off) |
| next_card_number | INTEGER | NOT NULL, DEFAULT 1 — counter backing board-scoped card numbers |
| covers_enabled | INTEGER | NOT NULL, DEFAULT 1 (boolean) — show/hide all card covers |
| is_template | INTEGER | NOT NULL, DEFAULT 0 (boolean) — board-template flag (duplicate flow pending, GH-27) |
| background_type | TEXT | NULLABLE ('color' or 'gradient') |
| background_value | TEXT | NULLABLE (hex color or gradient preset id) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |
| archived_at | INTEGER | NULLABLE (Unix timestamp; NULL = active, non-NULL = archived) |

### api_tokens

Bearer tokens for the quick-add endpoint (one per user, rotate-on-generate).

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid) |
| user_id | TEXT | NOT NULL, FK → users.id, CASCADE |
| token_hash | TEXT | NOT NULL, UNIQUE (sha256 hex of the plaintext token; plaintext shown once, never stored) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| last_used_at | INTEGER | NULLABLE (Unix timestamp) |

### lists

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| name | TEXT | NOT NULL |
| board_id | TEXT | NOT NULL, FK → boards.id, CASCADE |
| position | TEXT | NOT NULL (fractional index string) |
| is_done | INTEGER | NOT NULL, DEFAULT 0 (boolean; at most one per board) |
| card_limit | INTEGER | NULLABLE — advisory WIP limit (1-999); UI turns the count red when exceeded |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |
| archived_at | INTEGER | NULLABLE (Unix timestamp; NULL = active, non-NULL = archived) |

**Indexes**: `(board_id, position)` for efficient sorted retrieval.

### cards

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| number | INTEGER | NULLABLE — board-scoped auto-increment (allocated from boards.next_card_number; null only for pre-migration rows). Never reused; reassigned on cross-board moves |
| title | TEXT | NOT NULL |
| description | TEXT | NULLABLE |
| list_id | TEXT | NOT NULL, FK → lists.id, CASCADE |
| position | TEXT | NOT NULL (fractional index string) |
| completed | INTEGER | NOT NULL, DEFAULT 0 (boolean) |
| is_template | INTEGER | NOT NULL, DEFAULT 0 (boolean) — offered as "From template" in the add-card UI; copies are always normal cards |
| cover_type | TEXT | NULLABLE ('color' or 'image') |
| cover_value | TEXT | NULLABLE (hex color or http(s) image URL) |
| completed_at | INTEGER | NULLABLE (Unix timestamp; set when completed becomes true) |
| due_date | INTEGER | NULLABLE (Unix timestamp) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |
| archived_at | INTEGER | NULLABLE (Unix timestamp; NULL = active, non-NULL = archived) |

**Indexes**: `(list_id, position)` for efficient sorted retrieval.

### checklists

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| name | TEXT | NOT NULL |
| card_id | TEXT | NOT NULL, FK → cards.id, CASCADE |
| position | TEXT | NOT NULL (fractional index string) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |

**Indexes**: `(card_id, position)` for efficient sorted retrieval.

### checklist_items

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| title | TEXT | NOT NULL |
| checklist_id | TEXT | NOT NULL, FK → checklists.id, CASCADE |
| position | TEXT | NOT NULL (fractional index string) |
| completed | INTEGER | NOT NULL, DEFAULT 0 (boolean) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |

**Indexes**: `(checklist_id, position)` for efficient sorted retrieval.

### labels

Board-scoped colored tags.

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid) |
| name | TEXT | NOT NULL (may be empty; max 50 chars) |
| color | TEXT | NOT NULL (#rrggbb hex) |
| board_id | TEXT | NOT NULL, FK → boards.id, CASCADE |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |

**Indexes**: `(board_id)`.

### card_labels

Join table assigning labels to cards.

| Column | Type | Constraints |
|--------|------|-------------|
| card_id | TEXT | FK → cards.id, CASCADE; PK part |
| label_id | TEXT | FK → labels.id, CASCADE; PK part |

**Indexes**: composite PK `(card_id, label_id)`, plus `(label_id)`. Because labels are board-scoped, cross-board card/list moves delete the affected `card_labels` rows.

### comments

Markdown comments on cards (single-user app, so no author column).

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid) |
| body | TEXT | NOT NULL (markdown, max 5000 chars) |
| card_id | TEXT | NOT NULL, FK → cards.id, CASCADE |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |

**Indexes**: `(card_id)`.

## Fractional Indexing Strategy

Instead of integer position fields, we use **string-based fractional indexing** for the `position` column on `lists` and `cards`.

### Why

- Reordering an item requires updating **only 1 row** (the moved item)
- Integer positions require renumbering all subsequent items on every reorder
- Used by Figma, Linear, and other production apps

### How It Works

Position strings are lexicographically ordered. To insert between two items:

```
Item A position: "a"
Item B position: "b"
New position:    "aN"  (lexicographically between "a" and "b")
```

The `generateKeyBetween(a, b)` function computes a new string that sorts between `a` and `b`:
- `generateKeyBetween(null, null)` → initial position (e.g., "a0")
- `generateKeyBetween(null, "a0")` → position before first item
- `generateKeyBetween("a0", null)` → position after last item
- `generateKeyBetween("a0", "a1")` → position between two items

### Implementation

We use the `fractional-indexing` npm package algorithm, implemented in `@kanbang/shared` at `src/utils/fractional-index.ts` for use by both API and frontend.

## Archiving Strategy

Boards, lists, and cards are never permanently deleted. Instead, each table has an `archived_at` column:

- **Active items:** `archived_at IS NULL` — included in all normal queries
- **Archived items:** `archived_at IS NOT NULL` — excluded from normal queries; accessible only through dedicated archive-view endpoints

Archive state is **independent per item**. Archiving a board does not archive its lists or cards; archiving a list does not archive its cards. Display logic hides children transitively (e.g., an archived list's cards are not shown even if those cards are active). This means unarchiving is always a single-item operation — just clear that item's `archived_at`.

Items are never permanently deleted through the application. The only content that can be permanently deleted is passkeys (credentials), checklists, checklist items, labels, comments, and the quick-add token — these are lightweight and do not warrant archival.

## Done Column Auto-Archive

Cards in a Done list (`is_done = true`) that have been completed for 3+ days (`completed_at` is older than 3 days) are automatically archived. This runs lazily on board fetch (`BoardService.archiveStaleDoneCards`, called from `GET /boards/:boardId`) — there is no background job. It only applies to cards in Done lists; completed cards in regular lists are not auto-archived.

## Migration Strategy

- Migrations are generated by `drizzle-kit generate` and stored in `packages/api/src/db/migrations/`
- Applied via `drizzle-kit migrate`
- Each migration is a SQL file with an up migration
- In Docker, migrations run on API startup before accepting requests
