# Plan: Board Background (Color + Gradient Presets)

## Context

Today every board renders on the default app background. This plan adds a per-board background setting with two modes: a solid color (hex) or one of 10 curated gradient presets. No custom uploads, no Unsplash, no patterns — those are deferred to a potential v2.

Scope is per-board (not per-user). Any authenticated user with access to the board can change its background — in practice today that means the board owner, since there is no member/role system yet.

Tracked in [docs/feature-ideas.md](../feature-ideas.md) under "Board Settings → Background image/color".

---

## Design Decisions

### Storage: two columns on `boards`

Add `background_type` (`'color' | 'gradient' | null`) and `background_value` (hex string like `#1e88e5` for color, or preset ID like `sunset` for gradient) to the `boards` table. Both nullable; null type means "use app default".

Two columns beat a single tagged string or JSON blob: cheap to validate at the Zod layer, trivial to query, and the preset ID stays version-controlled in code — if we later rename a preset's CSS, persisted boards keep working because only the ID is stored.

Rejected alternatives:

- **Single TEXT column with tagged string (`color:#...` / `gradient:sunset`)** — requires custom parsing everywhere, and validators end up regex-matching.
- **JSON column** — overkill for two small fields; loses the schema-level guarantees.

### Preset source of truth: `@kanbang/shared`

Export `BACKGROUND_GRADIENT_PRESETS` from `packages/shared/src/` as a readonly array of `{ id, name, css }`. Both API validation (Zod enum of preset IDs) and the web picker import from here. No duplication.

### Gradient catalog (v1 = 10 presets)

Curated mix of calm/warm/cool/dark/vibrant. IDs are lowercase kebab; CSS is a `linear-gradient(...)` string so it drops straight into a CSS background value.

| ID         | Name      | Feel    | CSS (illustrative; final values tuned during impl) |
|------------|-----------|---------|----------------------------------------------------|
| `slate`    | Slate     | muted   | `linear-gradient(135deg, #64748b, #475569)`        |
| `sage`     | Sage      | muted   | `linear-gradient(135deg, #84a98c, #52796f)`        |
| `sunset`   | Sunset    | warm    | `linear-gradient(135deg, #f59e0b, #ef4444)`        |
| `peach`    | Peach     | warm    | `linear-gradient(135deg, #fecaca, #fdba74)`        |
| `ocean`    | Ocean     | cool    | `linear-gradient(135deg, #3b82f6, #06b6d4)`        |
| `twilight` | Twilight  | cool    | `linear-gradient(135deg, #6366f1, #8b5cf6)`        |
| `aurora`   | Aurora    | vibrant | `linear-gradient(135deg, #10b981, #3b82f6, #8b5cf6)` |
| `midnight` | Midnight  | dark    | `linear-gradient(135deg, #0f172a, #1e293b)`        |
| `graphite` | Graphite  | dark    | `linear-gradient(135deg, #1f2937, #374151)`        |
| `nebula`   | Nebula    | dark    | `linear-gradient(135deg, #1e1b4b, #581c87)`        |

### Contrast: semi-transparent list columns

Gradients (especially `sunset`, `aurora`) will make today's list-column background clash with the dark text inside. List columns get a semi-transparent white background (`rgba(255,255,255,0.88)`) with a subtle backdrop blur so cards stay legible over any background. The app-default (no board background set) path is unchanged — lists only gain the transparency when a board background is active.

### Default = null (app default)

Boards created before this feature get `NULL` for both columns (migration does not backfill). The UI's "Reset to default" option sets both back to null.

---

## Implementation Steps

### Step 1 — Shared package: preset constant

File: `packages/shared/src/background-presets.ts` (new)

```ts
export const BACKGROUND_GRADIENT_PRESETS = [
  { id: 'slate', name: 'Slate', css: 'linear-gradient(135deg, #64748b, #475569)' },
  // ...9 more
] as const;

export type BackgroundGradientId = (typeof BACKGROUND_GRADIENT_PRESETS)[number]['id'];
```

Export from the package barrel.

### Step 2 — DB migration

File: `packages/api/src/db/schema/boards.ts`

Add:

```ts
backgroundType: text('background_type', { enum: ['color', 'gradient'] }),
backgroundValue: text('background_value'),
```

Run `pnpm db:generate` to create the migration, then `pnpm db:migrate`.

### Step 3 — API: validation + update endpoint

- Extend the board update Zod schema (in `packages/shared/src/schemas/`) with optional `backgroundType` and `backgroundValue`. Validate:
  - If `backgroundType === 'color'`, `backgroundValue` must match `/^#[0-9a-fA-F]{6}$/`.
  - If `backgroundType === 'gradient'`, `backgroundValue` must be one of the preset IDs (Zod enum built from `BACKGROUND_GRADIENT_PRESETS.map(p => p.id)`).
  - If `backgroundType === null`, `backgroundValue` must also be null.
- `BoardService.update` writes the two columns. Existing `PATCH /api/v1/boards/:id` route picks up the fields without needing a new endpoint.
- Response schema for boards adds both fields.

### Step 4 — Web: board page applies the background

File: [packages/web/src/routes/boards/[boardId]/+page.svelte](../../packages/web/src/routes/boards/[boardId]/+page.svelte)

- Derive a CSS background string from `board.backgroundType` + `board.backgroundValue`, looking up gradient CSS in the shared preset list. Null type → no inline style (falls back to app default).
- Apply to the board's main container via inline `style=` (not a global body background — keep boards without bg unaffected).
- Update list-column CSS to use `rgba(255,255,255,0.88)` and a light backdrop-filter blur **only when a background is set** (class toggle based on presence of `board.backgroundType`).

### Step 5 — Web: background picker in board settings

- Add a "Background" section to the existing settings UI in the board page.
- Two tabs / segmented control: "Color" and "Gradient".
- **Color tab**: native `<input type="color">` bound to a hex value + a "Reset to default" button.
- **Gradient tab**: grid of 10 swatches, each a small div rendering its `css` background; click selects it. Currently-selected preset gets a checkmark/ring.
- Save button calls `api('/boards/:id', { method: 'PATCH', body: ... })` with `backgroundType` + `backgroundValue`. Optimistic update: mutate the local board object on success.

### Step 6 — Tests

- **Unit (shared)**: snapshot the preset list to guard against accidental renames that would break persisted boards.
- **API integration** (`packages/api/tests/integration/`): PATCH rejects invalid hex, rejects unknown gradient IDs, accepts valid of each, accepts nulling both fields. Round-trip via GET returns the stored values.
- **E2E** (`e2e/`): happy path — open settings, pick a gradient, reload, verify the background persists.

---

## Out of Scope (v2 candidates)

- Custom image uploads (requires storage, resize pipeline, cleanup on board delete).
- Unsplash search integration (needs API key + attribution UI).
- Repeating patterns (SVG/CSS patterns) — could be added later as a third `background_type`.
- Per-user default background that applies to all boards.
- Per-list card-column color overrides.

## Verification

- `pnpm typecheck` passes.
- `pnpm test` passes, including new tests in step 6.
- `pnpm test:e2e` passes.
- Manual: create a board, pick each of the 10 gradients in turn, verify list-column text stays legible on every one; pick a custom color, reload, verify it persists; reset to default, verify board returns to the app default look.
