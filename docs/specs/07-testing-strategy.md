# KanBang — Testing Strategy

## Test Pyramid

```
        ╱  E2E  ╲          Few, critical user flows
       ╱─────────╲
      ╱Integration╲        API route tests (HTTP in/out)
     ╱─────────────╲
    ╱   Unit Tests   ╲     Services, utilities, components
   ╱───────────────────╲
```

## Tools

| Type | Tool | Scope |
|------|------|-------|
| Unit | Vitest | Services, utilities, Zod schemas, Svelte components |
| Integration | Vitest + Fastify `inject()` | Full HTTP request/response through API routes |
| E2E | Playwright | Complete user flows through the real app |
| Component | Vitest + @testing-library/svelte | Svelte component rendering + interaction |

## File Naming Conventions

| Type | Pattern | Location |
|------|---------|----------|
| Unit (API services) | `*.test.ts` | `packages/api/tests/unit/services/` |
| Unit (shared) | `*.test.ts` | `packages/shared/src/**/*.test.ts` |
| Integration | `*.test.ts` | `packages/api/tests/integration/` |
| Component | `*.test.ts` | `packages/web/tests/components/` |
| E2E | `*.spec.ts` | `e2e/` |

## Vitest Workspace Configuration

Tests are organized into three Vitest projects via `vitest.workspace.ts`:
- **shared**: Tests in `packages/shared/src/`
- **api**: Tests in `packages/api/tests/` with setup file for DB
- **web**: Tests in `packages/web/tests/` with jsdom environment

---

## Backend Unit Tests

### Target

Service functions: `auth.service.ts`, `board.service.ts`, `list.service.ts`, `card.service.ts`, `checklist.service.ts`, `checklist-item.service.ts`

### Approach

- Each service function takes a Drizzle DB instance as a parameter (dependency injection)
- Tests use an **in-memory SQLite database** with the schema applied
- Each test gets a fresh database (via `beforeEach`)

### Test Setup (`packages/api/tests/setup.ts`)

```typescript
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../src/db/schema.js';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './src/db/migrations' });
  return db;
}
```

### Example Test Cases

**board.service.test.ts:**
- `createBoard()` returns board with correct fields
- `getBoards()` returns only active boards for the given user (excludes archived)
- `getBoards()` with archived flag returns only archived boards
- `getBoardById()` returns board with nested active lists and cards sorted by position
- `getBoardById()` returns null for non-existent board
- `updateBoard()` updates name and updatedAt
- `archiveBoard()` sets archived_at; does not touch lists or cards
- `unarchiveBoard()` clears archived_at
- `getArchivedBoardItems()` returns archived lists and archived cards in active lists

**list.service.test.ts:**
- `createList()` auto-assigns position after last active list
- `createList()` in empty board assigns initial position
- `reorderList()` updates position correctly
- `archiveList()` sets archived_at on list only; cards are unaffected
- `unarchiveList()` clears archived_at

**card.service.test.ts:**
- `createCard()` auto-assigns position after last active card
- `createCard()` with dueDate stores the due date
- `updateCard()` sets/clears dueDate
- `updateCard()` with `completed: true` sets completedAt and auto-moves to Done list if one exists
- `updateCard()` with `completed: false` clears completedAt, does not auto-move back
- `moveCard()` within same list updates position only
- `moveCard()` across lists updates listId and position
- `archiveCard()` sets archived_at on the card
- `unarchiveCard()` clears archived_at

**list.service.test.ts (additions):**
- `setDone()` marks a list as Done; clears isDone on other lists in the same board
- `setDone(false)` removes Done status
- `getDoneList()` returns the Done list for a board, or null

**checklist.service.test.ts:**
- `create()` auto-assigns position after last checklist on the card
- `getByCardId()` returns checklists with nested items, ordered by position
- `update()` renames a checklist
- `reorder()` updates position
- `delete()` removes checklist and cascades to items

**checklist-item.service.test.ts:**
- `create()` auto-assigns position after last item in the checklist
- `update()` toggles completed, updates title
- `reorder()` updates position
- `delete()` removes item
- `convertToCard()` creates a new card and deletes the item

---

## Backend Integration Tests

### Target

Full HTTP request/response cycle through Fastify routes.

### Approach

- Import `buildApp()` from `app.ts` to create a Fastify instance
- Use `app.inject()` to simulate HTTP requests (no real port)
- Fresh in-memory SQLite DB per test suite
- Helper functions for common operations (register user, create board, etc.)

### Test Helpers (`packages/api/tests/integration/helpers.ts`)

```typescript
export async function registerUser(app, userData?) { ... }
export async function loginUser(app, credentials?) { ... }
export async function createBoard(app, sessionCookie, name?) { ... }
export async function createList(app, sessionCookie, boardId, name?) { ... }
export async function createCard(app, sessionCookie, listId, title?) { ... }
export function getSessionCookie(response) { ... }
```

### Test Suites

**auth.test.ts:**
- Register with valid data → 201, user returned, session cookie set
- Register with duplicate email → 409
- Register with invalid data → 400 with validation errors
- Login with valid credentials → 200, session cookie set
- Login with wrong password → 401
- GET /auth/me with valid session → 200 with user
- GET /auth/me without session → 401
- Logout → session destroyed, cookie cleared

**boards.test.ts:**
- Create board → 201
- List boards → returns only active boards for the user (archived excluded)
- List boards?archived=true → returns only archived boards
- Get board detail → includes active lists and cards sorted by position
- Get board detail → archived lists and cards excluded from response
- Get other user's board → 403
- Get non-existent board → 404
- Update board name → 200
- Archive board → 200; board no longer in active list
- Unarchive board → 200; board reappears in active list
- Get board archived items → returns archived lists and archived cards in active lists

**lists.test.ts:**
- Create list → 201, position auto-assigned
- Create multiple lists → positions are ordered
- Reorder list → position updated
- Archive list → 200; list excluded from board detail
- Unarchive list → 200; list reappears in board detail
- Archive list → cards remain unaffected (not archived)

**cards.test.ts:**
- Create card → 201, position auto-assigned
- Create card with dueDate → 201, dueDate in response
- Update card title/description → 200
- Update card dueDate → 200; clear with null → 200
- Update card completed → 200; completedAt set; auto-moves to Done list if present
- Update card completed to false → completedAt cleared; card stays in current list
- Move card within list → position updated, listId unchanged
- Move card across lists → both listId and position updated
- Archive card → 200; card excluded from list
- Unarchive card → 200; card reappears in list

**done-column.test.ts:**
- Designate Done list → isDone: true in response
- Only one Done list per board (setting another clears the first)
- Remove Done status → isDone: false
- Auto-archive: cards completed 3+ days in Done list get archived by cleanup job

**checklists.test.ts:**
- Create checklist on card → 201
- List checklists for card → ordered by position, includes items
- Rename checklist → 200
- Reorder checklist → 200
- Delete checklist → 200; cascades to items
- Create item → 201
- Toggle item completed → 200
- Reorder item → 200
- Delete item → 200
- Convert item to card → 201; item deleted, new card created
- Checklist progress in board detail response
- Ownership: 403 for another user's checklists

---

## Shared Package Tests

### Target

- Fractional indexing utility (`generateKeyBetween`)
- Zod validation schemas

### Fractional Index Tests

- `generateKeyBetween(null, null)` produces a valid starting key
- `generateKeyBetween('a0', null)` produces a key > 'a0'
- `generateKeyBetween(null, 'a0')` produces a key < 'a0'
- `generateKeyBetween('a0', 'a1')` produces a key between 'a0' and 'a1'
- Generated keys maintain lexicographic ordering across many insertions
- Edge case: inserting between adjacent keys repeatedly doesn't produce excessively long keys

### Validation Schema Tests

- Valid input passes validation
- Missing required fields are rejected
- Invalid email format is rejected
- Username with invalid characters is rejected
- Password too short is rejected
- Board name empty string is rejected
- Card title exceeding max length is rejected

---

## Frontend Component Tests

### Target

Svelte components rendered in isolation.

### Approach

- Vitest with jsdom environment
- `@testing-library/svelte` for rendering and querying
- Mock API calls via `vi.mock()` or `msw`

### Test Cases

**BoardCard.test.ts:**
- Renders board name
- Renders creation date
- Is clickable (has link to board detail)

**ListColumn.test.ts:**
- Renders list name
- Renders all card items
- Shows create card form on "+ Add a card" click

**CardItem.test.ts:**
- Renders card title
- Shows edit/archive actions on hover or focus
- Renders description preview if present
- Renders due date badge with correct color state
- Renders checklist progress when present
- Shows reduced opacity for cards in Done list

**CardDetailModal.test.ts:**
- Opens with card data populated
- Edits title inline
- Sets/clears due date
- Edits description
- Renders checklists with items
- Toggles checklist item completion
- Adds/deletes checklist items
- Adds/deletes checklists
- Converts item to card

---

## E2E Tests (Playwright)

### Configuration (`playwright.config.ts`)

```typescript
export default defineConfig({
  testDir: './e2e',
  webServer: [
    {
      command: 'pnpm dev:api',
      port: 3001,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'pnpm dev:web',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: 'http://localhost:5173',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
});
```

### Test Data Isolation

Each test file creates a unique user via the registration endpoint, ensuring tests are independent. Test usernames/emails include a random suffix.

### Test Suites

**auth.spec.ts:**
- Register a new account
- Log out
- Log back in
- Access protected page without auth → redirected to login

**boards.spec.ts:**
- Create a new board
- See board in board list
- Rename a board
- Archive a board → board disappears from active list
- Show archived boards → archived board appears
- Unarchive a board → board reappears in active list

**lists.spec.ts:**
- Add a list to a board
- Rename a list
- Archive a list → list disappears from board
- Open archived items panel → archived list is visible
- Unarchive a list → list reappears on board

**cards.spec.ts:**
- Add a card to a list
- Edit card title
- Edit card description
- Set due date → badge appears on card
- Clear due date → badge disappears
- Archive a card → card disappears from list
- Open archived items panel → archived card is visible
- Unarchive a card → card reappears in its list

**checklists.spec.ts:**
- Click card → modal opens
- Add checklist → appears in modal
- Add items → appear with checkboxes
- Toggle item → progress updates on card face
- Complete all items → progress shows complete
- Delete item / delete checklist
- Convert item to card → new card appears in list
- Close modal → card face shows updated progress

**done-column.spec.ts:**
- Set a list as Done list via menu → checkmark icon appears
- Complete a card → card moves to Done list
- Uncomplete a card in Done list → card stays, checkbox unchecked
- Remove Done status from list → no more auto-moves

**due-dates.spec.ts:**
- Hover card → calendar icon appears
- Set due date → badge appears on card face
- Due date badge shows correct color (overdue = red, soon = yellow)
- Mark card with due date complete → green badge
- Remove due date → badge disappears

**drag-and-drop.spec.ts:**
- Drag a card to a different position within the same list
- Drag a card to a different list
- Drag a list to reorder
- Verify order persists after page reload

---

## Coverage Targets

| Scope | Target |
|-------|--------|
| Service functions | 80% line coverage |
| API routes | 70% line coverage |
| Shared utilities | 90% line coverage |
| Frontend components | 60% line coverage |
| Overall | 70% line coverage |

Coverage is measured by Vitest's built-in c8/istanbul integration. E2E tests are excluded from coverage metrics.

---

## CI Pipeline (implemented)

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR: lint → typecheck → Vitest suite → build → Playwright E2E.

As of 2026-07 the Vitest suite is 25 files / 319 tests (integration tests cover every route group, including quick-add, Trello import, comments, sort, copy/move, numbering, covers). E2E tests run against a production build with a file-based test DB. Historic test counts elsewhere in this document are point-in-time snapshots — check `pnpm test` output for current numbers.
