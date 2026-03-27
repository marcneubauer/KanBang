# Feature Ideas

Items within each section are ordered by usefulness.

## Core Card Enhancements

- [ ] **Checklists** — multiple checklists per card, each with ordered checkable items. Card face shows progress summary (e.g. "3/7"). Support "convert to card" to promote a checklist item into its own card.
- [ ] **Labels/tags** — board-scoped label sets, multiple labels per card. Card face shows colored chips. Filtering by label dims non-matching cards (non-destructive, preserves spatial context).
- [ ] **Due dates** — visual indicator on card face with states: neutral (far out), yellow (within 24hrs), red (overdue), green+checkmark (marked complete).
- [ ] **Attachments** — file uploads or URL links
- [ ] **Card cover images** — solid color or image banner at the top of the card face

## Board Organization

- [ ] **"Done" column** — auto-move checked/completed items to a dedicated "Done" list
  - Done column's cards are automatically archived 3 days after they are checked done
- [ ] **Card filtering** — filter bar at top of board accepting labels, assignees, due date ranges. Non-destructive: dims non-matching cards rather than hiding them to preserve spatial context.
- [ ] **Board search** — highlights matching cards in place (dims non-matching), does not navigate away from the board
- [ ] **Card quick-edit** — hover shows pencil icon, clicking opens inline popover to edit labels, due date, members, and title without opening the full card modal
- [ ] **List collapse** — collapsed list shows only its title in a narrow vertical strip
- [ ] **Copy/move card** — copy or move cards between lists or boards. Copy dialog with checkboxes to keep checklists/attachments/comments.
- [ ] **Sort list** — sort cards within a list by due date, name, or date created
- [ ] **List move/copy** — reorganize lists between boards

## Board Settings

- [x] **Board archive** — soft-delete for cards and lists. Archived items are hidden but searchable and restorable.
- [ ] **Card numbering** — auto-incrementing card IDs scoped to the board (like GitHub issues, e.g. #47)
- [ ] **List limit (WIP limits)** — max card count per list, list header turns red when exceeded
- [ ] **Background image/color** — solid color picker, curated gradient presets, stock photo library (e.g. Unsplash), custom image upload. Requires semi-transparent overlay behind list columns for text contrast.
- [x] **Closed boards** — archive an entire board without deleting it. Hidden from main view, accessible in "closed boards" section.
- [ ] **Visibility settings** — private (only members), workspace/team, or public
- [ ] **Member roles** — Admin (change settings, add/remove members), Member (edit cards), Viewer (read-only)
- [ ] **Invite links** — shareable URL granting access at a specified role level, with ability to disable/regenerate
- [ ] **Required fields** — enforce that cards in certain lists must have due date, assignee, or label before they can be moved
- [ ] **Default due date reminder** — board-level setting for when notification reminders fire (e.g. 1 day before due)
- [ ] **Board rules / automation** — trigger/action pairs (e.g. "when card moves to Done, mark all checklist items complete", "when due date is tomorrow, add label Urgent")
- [ ] **Board color theme** — accent colors applied to buttons, label defaults, and header elements beyond just the background.
- [ ] **Card covers on/off** — board-level toggle to disable card cover images for denser view
- [ ] **Card aging** — cards untouched for a configurable period get a faded/dusty visual treatment
- [ ] **Guest access** — add users to a single board without full workspace membership
- [ ] **Activity export** — CSV or JSON export of all cards and metadata
- [ ] **Voting** — members can upvote cards, vote count shown on card face. Useful for prioritization and feedback boards.

## Collaboration

- [ ] **Members/assignments** — assign cards to users, show avatars on card face
- [ ] **Comments** — threaded discussion per card with @mentions
- [ ] **Activity log** — audit trail of all changes per card and board
- [ ] **Watching** — subscribe to notifications on a card or board

## Power-Ups / Integrations

- [ ] **Card templates** — predefined card structures for repeating work
- [ ] **Board templates** — start new boards from a saved layout
- [ ] **Recurring cards** — auto-create cards on a schedule

## Views

- [ ] **Calendar view** — cards plotted by due date
- [ ] **Table/spreadsheet view** — flat list of all cards across lists
- [ ] **Dashboard** — summary stats (cards per list, overdue count, etc.)

## Auth

- [ ] **Password reset flow** — "forgot password" page with email-based reset tokens (requires SMTP setup)
