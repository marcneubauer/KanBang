# KanBang — Project Overview

## Goals

KanBang is a personal, self-hosted Trello clone for managing tasks using a kanban board interface. It prioritizes simplicity, speed, and full ownership of data.

## Scope (v1)

- **Boards**: Create, rename, archive, and unarchive boards
- **Lists**: Create, rename, archive, unarchive, and reorder lists within a board via drag-and-drop
- **Cards**: Create, edit (title + description), archive, unarchive, reorder within a list, and move across lists via drag-and-drop
- **Authentication**: Password-based registration/login with passkey (WebAuthn) support

## Scope (v2)

- **Due dates**: Per-card due date with visual status indicators (neutral, soon, overdue, complete)
- **Checklists**: Multiple checklists per card with ordered checkable items. Card face shows progress summary. Card detail modal for editing.
- **Done column**: Per-board "Done" list that completed cards auto-move into, with auto-archive after 3 days

## Scope (v3 — shipped 2026-07)

- **Labels** (board-scoped colored tags) with board-header filtering and search
- **Comments** (markdown) with count badges
- **Card extras**: covers (color / image URL), templates, board-scoped numbering (#N), copy/move across boards, quick edit, markdown descriptions
- **List extras**: sort, WIP limits, collapse, copy, move to another board
- **Board appearance**: color/gradient backgrounds with derived accent theming, card aging
- **Integrations**: Trello board import, full JSON export, quick-add REST endpoint with bearer-token auth (Apple Watch / Shortcuts)
- **Account**: change password, generic auth errors (anti-enumeration)

The complete current feature list lives in [../FEATURES.md](../FEATURES.md) — treat that as the source of truth.

## Non-Goals (current)

- Real-time collaboration / multi-user editing (member roles, assignments, invites remain open backlog ideas)
- File attachments or image **uploads** (card cover images are external URLs only)
- Calendar / table / dashboard views
- Email notifications or reminders
- Mobile app (responsive web only)

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 25 |
| Backend framework | Fastify | 5.x |
| Frontend framework | SvelteKit | 2.x (Svelte 5) |
| Database | SQLite | via better-sqlite3 |
| ORM | Drizzle ORM | 0.38.x |
| Auth (passwords) | argon2 | 0.41.x |
| Auth (passkeys) | @simplewebauthn/server + browser | 13.x |
| Validation | Zod | 3.x |
| Drag-and-drop | svelte-dnd-action | 0.9.x |
| Package manager | pnpm | 10.x |
| Testing (unit/integration) | Vitest | 3.x |
| Testing (E2E) | Playwright | 1.58.x |
| Deployment | Docker Compose | self-hosted |

## Glossary

| Term | Definition |
|------|-----------|
| **Board** | A named collection of lists. Each user can have multiple boards. |
| **List** | A named, ordered column within a board. Contains cards. |
| **Card** | A task item within a list. Has a title, optional description, optional due date, and optional checklists. |
| **Checklist** | A named, ordered list of checkable items within a card. |
| **Done List** | A special list per board that receives completed cards automatically. |
| **Position** | A string-based fractional index that determines sort order. |
| **Passkey** | A WebAuthn/FIDO2 credential for passwordless authentication. |
