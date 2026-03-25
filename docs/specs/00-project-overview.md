# KanBang — Project Overview

## Goals

KanBang is a personal, self-hosted Trello clone for managing tasks using a kanban board interface. It prioritizes simplicity, speed, and full ownership of data.

## Scope (v1)

- **Boards**: Create, rename, archive, and unarchive boards
- **Lists**: Create, rename, archive, unarchive, and reorder lists within a board via drag-and-drop
- **Cards**: Create, edit (title + description), archive, unarchive, reorder within a list, and move across lists via drag-and-drop
- **Authentication**: Password-based registration/login with passkey (WebAuthn) support

## Non-Goals (v1)

- Real-time collaboration / multi-user editing
- File attachments or image uploads
- Labels, tags, or color coding
- Due dates or calendar integration
- Checklists within cards
- Comments or activity log
- Board backgrounds or themes
- Search functionality
- Email notifications
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
| **Card** | A task item within a list. Has a title and optional description. |
| **Position** | A string-based fractional index that determines sort order. |
| **Passkey** | A WebAuthn/FIDO2 credential for passwordless authentication. |
