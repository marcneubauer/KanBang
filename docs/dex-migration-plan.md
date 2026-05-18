# Dex Migration Plan

One-time migration of KanBang's task tracking from the legacy `docs/plans/` + `docs/logs/` + `docs/feature-ideas.md` system to [dex](https://dex.rip) with GitHub Issues sync.

This document is a handoff from a planning session. Read it end-to-end before doing anything. Delete this file after the migration is complete.

---

## Current state (pre-migration)

- **`docs/plans/`** — 17 plan docs using prefix convention: `X_` (14 completed), `O_` (3 not started, listed below), `I_` (incomplete; none currently). Each is a rich design doc with Context, Design Decisions, and Implementation Steps.
- **`docs/logs/`** — 20 dated implementation logs. These are the natural "result" text for completed plans.
- **`docs/feature-ideas.md`** — flat backlog of checkbox items (mix of done `[X]` and pending `[ ]`).
- **`docs/specs/`** — 8 architecture/spec docs. **NOT tasks. Do not migrate. Leave in place.**
- **`CLAUDE.md`** — documents the `X_/O_/I_` convention; will be updated in Step 7.

The 3 pending (`O_`) plans:
- `docs/plans/O_board-background.md`
- `docs/plans/O_global-error-indicator.md`
- `docs/plans/O_web-proxy-hardening.md`

Dex is NOT installed yet. `.dex/` does not exist.

---

## Decisions already made (do not re-litigate)

1. **Migration scope: Everything.** Migrate pending plans, the unchecked backlog from `feature-ideas.md`, AND reconstruct completed `X_` plans as dex tasks with completion results synthesized from matching logs.
2. **Old files: Move to `docs/archive/`** after migration. Not delete, not leave in place — relocate to clearly signal they're frozen.
3. **GitHub sync: Yes.** Enable `sync.github.enabled=true`. The repo has a GitHub remote; `gh` CLI auth is dex's default authentication source.
4. **Commit `.dex/` to git.** Do NOT add it to `.gitignore`. Reasons: (a) fast local agent-readable record; (b) re-enables dex's sync-on-push detection so issues close only when completion commits reach the remote.
5. **Granular git checkpoints.** Migration must produce a traceable git history (9 commits per the plan below), not one big-bang commit.
6. **Sonnet is fine for this work.** Each task is independent and recoverable; no cascading reasoning required.

---

## Open question to ask the user before starting

When reconstructing the 14 completed (`X_`) plans, `dex complete --commit <sha>` accepts a git commit SHA so the GitHub Issue closes with a reference to the actual code that landed it. How careful should the commit-hunting be?

- **Option 1 (recommended):** Best-effort, single commit per plan via `git log --oneline --grep=<keyword>`, fall back to `--no-commit` when ambiguous. Fast; ~80% will get a commit ref.
- **Option 2:** One commit per plan, picked by carefully inspecting `git log` for each plan. Slower; nearly all get accurate refs.
- **Option 3:** Per-subtask commits where identifiable. Slowest; usually overkill.

Default to option 1 unless the user chooses otherwise.

---

## Reference docs (read before executing)

- https://dex.rip/guide — workflow concepts and the core idea
- https://dex.rip/cli — command reference (`dex create`, `dex complete`, `dex sync`, `dex import`, etc.)
- https://dex.rip/config — `.dex/config.toml` schema, storage modes, sync settings
- https://dex.rip/install — install instructions

Key dex facts the migration relies on:
- `.dex/tasks.jsonl` is the local store; one task per line.
- `dex complete` marks done and attaches a result; it does **not** delete the task.
- `dex sync` is one-way local→GitHub. `dex import #N` is the reverse direction.
- Sync-on-push: a completed task syncs as an open issue until the completion commit reaches the remote, then a second `dex sync` closes the issue.
- `dex import --all` only pulls issues with the `dex` label (or `sync.github.label_prefix` value). Per-issue `dex import #N` works without the label.
- Three hierarchy levels: Epic → Task → Subtask. Don't try to nest deeper.

---

## The plan (8 steps, 9 commit checkpoints)

### Checkpoint 0 — clean baseline

Before anything: confirm `git status` is clean. If there are uncommitted changes, stop and ask the user. Confirm the current branch is appropriate — recommend creating `chore/dex-migration` so the trail can be reviewed before merging into main.

### Step 1 — Install & initialize

```
pnpm add -g @zeeg/dex
pnpx skills add dcramer/dex
dex --version
gh auth status      # confirm gh is authenticated; dex's default auth source
dex init            # creates .dex/ in repo root
```

If `gh auth status` shows not authenticated, stop and ask the user to run `gh auth login` or set `GITHUB_TOKEN`.

### Step 2 — Enable GitHub sync

```
dex config --local sync.github.enabled=true
dex config --list   # verify
```

Owner/repo are auto-detected from the git remote. Auto-sync is on by default.

**Checkpoint 1** — `chore(dex): install dex and enable github sync`

Commit `.dex/config.toml`, `.dex/` skeleton, and any `.claude/` skill files created by `pnpx skills add`. Push. Verify the repo still builds: `pnpm install && pnpm typecheck`.

### Step 3 — Migrate the 3 pending (`O_`) plans

For each of the 3 pending plans:

1. Read the plan file in full.
2. Create a top-level dex task: `dex create "<plan title>" --description "<Context + Design Decisions sections>"`.
3. If the plan's "Implementation Steps" section has more than ~3 distinct steps, create subtasks: `dex create "<step name>" --parent <task-id> --description "<step content>"`.
4. If the plan has fewer than ~3 steps, leave it flat — no subtasks.
5. Verify each top-level task appears as an open GitHub Issue with subtask checklists in the body.

**Checkpoint 2** — `chore(dex): migrate pending plans (O_) to dex tasks`

Commit. Push. Spot-check: `dex list` shows the 3 epics; GitHub Issues tab shows 3 new open issues.

### Step 4 — Convert backlog from `feature-ideas.md`

Read `docs/feature-ideas.md`. For each unchecked `[ ]` item:

- Create a flat dex task: `dex create "<item title>" --description "<item description>"`.
- Skip `[X]` items entirely (those are covered by completed plans in Step 5).
- Group-related items can be created as subtasks of a parent epic when the section heading implies cohesion (e.g. all "Card Enhancements" items as subtasks of a "Card Enhancements" epic) — use judgment, but default to flat unless grouping is obvious.

**Checkpoint 3** — `chore(dex): import feature-ideas.md backlog into dex`

Commit. Push. `dex list` should now show pending plans + backlog.

### Step 5 — Reconstruct the 14 completed (`X_`) plans

The bulk of the work. For each `X_` plan:

1. Read the plan file.
2. Find the matching log(s) in `docs/logs/` by slug similarity and date proximity. Some plans have multiple logs (e.g. `X_archive-instead-of-delete.md` → `2026-03-20T00-00_archive-instead-of-delete.md` + `2026-03-20T20-00_archive-implementation.md`). Some logs cover multiple plans.
3. Create the task + subtasks (same shape as Step 3).
4. Synthesize a result paragraph from the log(s): what was done, key decisions, verification (tests passing, etc.).
5. Find a commit SHA per the chosen option (see "Open question" above). Use `git log --oneline --grep=<keyword>` or look at log files for SHA references.
6. Complete each subtask first (dex enforces this), then the parent: `dex complete <id> --result "<synthesized result>" --commit <sha>` (or `--no-commit` if ambiguous).

Batch the 14 plans into 3 commits, grouped chronologically:

**Batch A — early March plans:** `X_rename-project.md`, `X_testing-improvements.md`, `X_api-best-practices.md`, `X_card-completed-checkbox.md`, `X_api-spec-update-and-claude-tool-readiness.md`

**Checkpoint 4** — `chore(dex): reconstruct completed plans (early March batch)`

Commit. Push. Run `dex sync` (this round closes the just-pushed completed issues on GitHub).

**Batch B — mid/late March plans:** `X_archive-instead-of-delete.md`, `X_board-ui-tweaks.md`, `X_code-review-fixes.md`, `X_list-collapse.md`, `X_due-dates.md`, `X_checklists.md`, `X_board-settings.md`, `X_done-column.md`

**Checkpoint 5** — `chore(dex): reconstruct completed plans (mid/late March batch)`

Commit. Push. `dex sync`.

**Batch C — April plans:** `X_fastify-schema-and-response-types.md` (the largest; ~10KB, multiple phase logs)

**Checkpoint 6** — `chore(dex): reconstruct completed plans (April batch)`

Commit. Push. `dex sync`. After this, `dex list --completed` should show all 14, and the GitHub Issues tab should show 14 closed issues with commit refs (where supplied).

### Step 6 — Archive the old files

```
git mv docs/plans docs/archive/plans
git mv docs/logs  docs/archive/logs
git mv docs/feature-ideas.md docs/archive/feature-ideas.md
```

Create `docs/archive/README.md` with content:

```
# Archive

Pre-dex task tracking, frozen for historical reference. Do not add new
content here.

Live task tracking has moved to dex (`.dex/` directory + GitHub Issues).
See CLAUDE.md for the current workflow.

Contents:
- plans/ — design docs using legacy X_/O_/I_ prefix convention
- logs/  — dated session implementation logs
- feature-ideas.md — flat backlog (migrated to dex tasks)
```

Leave `docs/specs/` in place. Do not move it.

**Checkpoint 7** — `chore(dex): archive pre-dex plans, logs, and feature-ideas`

Commit (primarily renames; `git log --follow` keeps history intact). Push.

### Step 7 — Update `CLAUDE.md`

In `CLAUDE.md`, replace the Monorepo Structure section's plan-prefix description and add a new Task Management section. Specifically:

Find this block in `CLAUDE.md`:

```
│   └── plans/     # Planning documents: X_ are completed, O_ are not started, I_ are incomplete
```

Replace with:

```
│   └── archive/   # Pre-dex task tracking (plans, logs, feature-ideas), frozen for reference
```

Then add a new section near the top, after Overview:

```
## Task Management

Tasks live in `.dex/` (committed) and sync to GitHub Issues automatically.

- Use `/dex` to plan and track work persistently across sessions.
- Local-first: `dex list`, `dex list --all`, `dex show <id>` read from `.dex/` without network calls.
- Issues created on GitHub: run `dex import --all` (or `dex import #N`) to pull them into `.dex/`. Apply the `dex` label to remote-created issues you want round-tripped via `--all`.
- Always pass `--commit <sha>` (or `--no-commit`) to `dex complete` so issues close cleanly on push.
- The pre-dex docs/plans and docs/logs folders are archived under docs/archive/.
```

**Checkpoint 8** — `docs(dex): update CLAUDE.md to document dex workflow`

Commit. Push.

### Step 8 — Final verification

```
dex sync --dry-run         # should show "no changes"
dex list                   # pending + backlog visible
dex list --completed       # 14 reconstructed completed tasks visible
dex list --issue 1         # spot-check round-trip lookup works
pnpm install && pnpm typecheck && pnpm test
```

On GitHub: confirm Issue count, open/closed split, commit refs on closed issues. Spot-check 2–3 reconstructed tasks against their archived plan + log for fidelity.

**Checkpoint 9** — `chore(dex): post-migration verification`

Only commit if verification surfaced fixes (e.g. CLAUDE.md typo, a missed plan). If on a `chore/dex-migration` branch, open a PR or fast-forward into main.

Then delete this file (`docs/dex-migration-plan.md`) — its job is done.

---

## How to start (kickoff prompt for the new session)

A natural prompt to give to the new Sonnet session:

> Read `docs/dex-migration-plan.md` and execute it. Ask me the open question about commit-hunting precision before starting Step 5, but proceed through Steps 1-4 on your own.

The session should respect the commit checkpoints — do not bundle multiple checkpoints into one commit, and do not start a checkpoint's work until the prior checkpoint's commit + push has succeeded.
