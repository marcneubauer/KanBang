# Plan: Checklists

## Context

Add multiple checklists per card, each with ordered checkable items. Card face shows a progress summary (e.g. "3/7"). Support "convert to card" to promote a checklist item into its own card.

Currently there is no card detail modal — all editing is inline on the board page. Checklists will need a card detail modal to be usable.

---

## Design Decisions

### Card detail modal required

Checklists can't fit in the compact card face. Clicking a card will open a detail modal showing title, description (currently not editable in UI), and checklists. The card face shows only a compact progress indicator.

### Two new tables

- `checklists` — belongs to a card, has a name and fractional position
- `checklist_items` — belongs to a checklist, has a title, completed boolean, and fractional position

### Cascade deletes

Card → checklists → checklist_items (follows existing card → list cascade pattern).

### "Convert to card" is a create + delete

Promoting a checklist item creates a new card in the same list as the parent card, then archives the checklist item. No special linking — keep it simple.

---

## Database Changes

### New table: `checklists`

**File:** `packages/api/src/db/schema/checklists.ts` (new)

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | nanoid |
| name | text | 1–100 chars |
| cardId | text FK → cards | cascade delete |
| position | text | fractional index |
| createdAt | timestamp | |
| updatedAt | timestamp | |

Index on `(cardId, position)`.

### New table: `checklist_items`

**File:** `packages/api/src/db/schema/checklist-items.ts` (new)

| Column | Type | Notes |
|--------|------|-------|
| id | text PK | nanoid |
| title | text | 1–500 chars |
| checklistId | text FK → checklists | cascade delete |
| position | text | fractional index |
| completed | boolean | default false |
| createdAt | timestamp | |
| updatedAt | timestamp | |

Index on `(checklistId, position)`.

### Schema barrel export

**File:** `packages/api/src/db/schema.ts` — add exports for both new tables.

### Migration

Run `pnpm db:generate` to produce the migration SQL.

---

## Shared Types

### `packages/shared/src/types/checklist.ts` (new)

```typescript
export interface Checklist {
  id: string;
  name: string;
  cardId: string;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  title: string;
  checklistId: string;
  position: string;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChecklistProgress {
  total: number;
  completed: number;
}
```

### `packages/shared/src/validation/checklist.ts` (new)

```typescript
export const createChecklistSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export const updateChecklistSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
});

export const reorderChecklistSchema = z.object({
  position: z.string().min(1),
});

export const createChecklistItemSchema = z.object({
  title: z.string().min(1).max(500).trim(),
});

export const updateChecklistItemSchema = z.object({
  title: z.string().min(1).max(500).trim().optional(),
  completed: z.boolean().optional(),
});

export const reorderChecklistItemSchema = z.object({
  position: z.string().min(1),
});

export const convertToCardSchema = z.object({
  listId: z.string().min(1),
});
```

Export both from `packages/shared/src/types/index.ts` and `packages/shared/src/validation/index.ts`.

---

## API Endpoints

### Checklist CRUD

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/api/v1/cards/:cardId/checklists` | — | Returns all checklists with items for a card |
| POST | `/api/v1/cards/:cardId/checklists` | `{ name }` | Create checklist, appended to end |
| PATCH | `/api/v1/checklists/:checklistId` | `{ name }` | Rename |
| PATCH | `/api/v1/checklists/:checklistId/reorder` | `{ position }` | Reorder within card |
| DELETE | `/api/v1/checklists/:checklistId` | — | Hard delete (checklists are lightweight, no archive) |

### Checklist Item CRUD

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/v1/checklists/:checklistId/items` | `{ title }` | Create item, appended to end |
| PATCH | `/api/v1/checklist-items/:itemId` | `{ title?, completed? }` | Update |
| PATCH | `/api/v1/checklist-items/:itemId/reorder` | `{ position }` | Reorder within checklist |
| DELETE | `/api/v1/checklist-items/:itemId` | — | Hard delete |
| POST | `/api/v1/checklist-items/:itemId/convert-to-card` | `{ listId }` | Create card from item, delete item |

### Ownership verification

Checklist → card → list → board → userId. Same traversal pattern as existing card ownership checks.

---

## Service Layer

### `packages/api/src/services/checklist.service.ts` (new)

Methods:
- `getByCardId(cardId)` — returns checklists with nested items, ordered by position
- `create(cardId, input)` — create checklist with fractional position at end
- `update(checklistId, input)` — rename
- `reorder(checklistId, position)` — update position
- `delete(checklistId)` — hard delete (cascades to items)
- `getCardId(checklistId)` — helper for ownership verification

### `packages/api/src/services/checklist-item.service.ts` (new)

Methods:
- `create(checklistId, input)` — create item with fractional position at end
- `update(itemId, input)` — update title/completed
- `reorder(itemId, position)` — update position
- `delete(itemId)` — hard delete
- `convertToCard(itemId, listId)` — create card from item title, delete item, return new card
- `getChecklistId(itemId)` — helper for ownership verification

---

## Board Detail Response Changes

**File:** `packages/api/src/services/board.service.ts`

The board detail endpoint (`getById`) currently returns `{ ...board, lists: [{ ...list, cards: [...] }] }`.

Add a `checklistProgress` field to each card in the response:

```typescript
// For each card, query checklist item counts
const progress = await db
  .select({
    total: count(),
    completed: count(sql`CASE WHEN ${checklistItems.completed} = 1 THEN 1 END`),
  })
  .from(checklistItems)
  .innerJoin(checklists, eq(checklistItems.checklistId, checklists.id))
  .where(eq(checklists.cardId, card.id));

return { ...card, checklistProgress: { total: progress.total, completed: progress.completed } };
```

**Do NOT** include full checklist data in the board response — only the progress summary. Full data is fetched when the card modal opens via `GET /api/v1/cards/:cardId/checklists`.

---

## Frontend Changes

### Card Detail Modal (new component)

**File:** `packages/web/src/lib/components/CardDetailModal.svelte` (new)

Triggered by clicking a card on the board. Shows:
- Card title (editable inline)
- Card description (editable textarea, currently not exposed in UI)
- Checklists section:
  - Each checklist: name (editable), progress bar, delete button
  - Each item: checkbox + title (editable inline), delete button, drag handle for reorder
  - "Add item" input at bottom of each checklist
  - "Add checklist" button at bottom
  - "Convert to card" option in item context menu

### Card Face Progress Indicator

**File:** `packages/web/src/routes/boards/[boardId]/+page.svelte`

Below the card title, show a compact progress indicator when `checklistProgress.total > 0`:
- Checkbox icon + "3/7" text
- Green when all complete, neutral otherwise

### Click behavior change

Currently clicking a card does nothing (double-click enters title edit). Change to:
- **Single click** → open card detail modal
- **Double-click** → inline title edit (keep existing)

This requires distinguishing single vs double click with a short delay (~200ms).

---

## Integration Tests

**File:** `packages/api/tests/integration/checklists.test.ts` (new)

Test cases:
- Create checklist on a card
- List checklists for a card (ordered by position)
- Rename checklist
- Reorder checklists
- Delete checklist (cascades to items)
- Create checklist item
- Toggle item completed
- Reorder items
- Delete item
- Convert item to card (new card created, item deleted)
- Progress counts in board detail response
- Ownership: cannot access another user's checklists (403)
- Not found: 404 for nonexistent IDs

---

## E2E Tests

**File:** `e2e/checklists.spec.ts` (new)

- Click card → modal opens
- Add checklist → appears in modal
- Add items → appear with checkboxes
- Toggle item → progress updates on card face
- Complete all items → progress shows green
- Delete item / delete checklist
- Convert item to card → new card appears in list
- Close modal → card face shows updated progress

---

## Implementation Order

1. DB schema + migration (2 new tables)
2. Shared types + validation schemas
3. Checklist service + checklist item service
4. API routes + ownership verification
5. Update board detail response (progress summary)
6. Integration tests
7. Card detail modal component
8. Checklist UI inside modal
9. Card face progress indicator
10. E2E tests
