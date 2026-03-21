# KanBang — Database Schema

## Entity-Relationship Diagram

```
┌──────────┐     ┌─────────────┐
│  users   │──┐  │ credentials │
│          │  │  │  (passkeys) │
└────┬─────┘  └──┤             │
     │            └─────────────┘
     │
     ├──── sessions
     │
     └──── boards
              │
              └──── lists
                      │
                      └──── cards
```

All relationships use `ON DELETE CASCADE`.

## Tables

### users

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| email | TEXT | NOT NULL, UNIQUE |
| username | TEXT | NOT NULL, UNIQUE |
| password_hash | TEXT | NULLABLE (passkey-only users may not have a password) |
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
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |
| archived_at | INTEGER | NULLABLE (Unix timestamp; NULL = active, non-NULL = archived) |

### lists

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| name | TEXT | NOT NULL |
| board_id | TEXT | NOT NULL, FK → boards.id, CASCADE |
| position | TEXT | NOT NULL (fractional index string) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |
| archived_at | INTEGER | NULLABLE (Unix timestamp; NULL = active, non-NULL = archived) |

**Indexes**: `(board_id, position)` for efficient sorted retrieval.

### cards

| Column | Type | Constraints |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY (nanoid, 21 chars) |
| title | TEXT | NOT NULL |
| description | TEXT | NULLABLE |
| list_id | TEXT | NOT NULL, FK → lists.id, CASCADE |
| position | TEXT | NOT NULL (fractional index string) |
| created_at | INTEGER | NOT NULL (Unix timestamp) |
| updated_at | INTEGER | NOT NULL (Unix timestamp) |
| archived_at | INTEGER | NULLABLE (Unix timestamp; NULL = active, non-NULL = archived) |

**Indexes**: `(list_id, position)` for efficient sorted retrieval.

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

Items are never permanently deleted through the application. The only content that can be permanently deleted is passkeys (credentials), which are not subject to this policy.

## Migration Strategy

- Migrations are generated by `drizzle-kit generate` and stored in `packages/api/src/db/migrations/`
- Applied via `drizzle-kit migrate`
- Each migration is a SQL file with an up migration
- In Docker, migrations run on API startup before accepting requests
