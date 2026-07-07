# Application Tracking Supertable — Design & Implementation Plan

> **Status: design doc for future scheduling — not yet approved for execution.** Written after Sprint 5a shipped a resume-card status dropdown that, on review, was judged too shallow for real application tracking (a resume card is the wrong unit of organization for "5 applications across different stages"). That commit was reverted. This doc designs the real thing: applications as first-class objects in a fully user-customizable table, in the spirit of Monday.com/Airtable — sortable and multi-sortable columns, user-defined attributes, drag-and-drop, and a timestamped change log.

> **For agentic workers, when this is scheduled:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Given the size (9 tasks spanning data model, CRUD, and a genuinely new UI surface), consider running this as two sequential sprints rather than one: Tasks 1–4 (data layer + basic table) as a first pass, Tasks 5–9 (customization, drag-and-drop, activity log, polish) as a second. Both are written below as one continuous plan so the split point can be chosen at execution time, not baked in now.

## What already exists (reusable, don't rebuild)

- **`applicationStatus` / `targetCompany` / `targetRole` / `parentResumeId`** already live on the `Resume` document (Sprint 5a, commits `38fd8f6`/`0f3366d`, kept). An `Application` row will *reference* a resume/version via `resumeId`, not duplicate these fields — but they're useful defaults to prefill from when creating an Application from a resume.
- **`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`** are already a dependency, already used for drag-and-drop reordering in the editor (`components/editor/EditTab.tsx`'s `DndContext`/`SortableContext`/`SortableAccordionItem` pattern, and `DesignPanel.tsx`'s column-assignment drag). Reuse this exact pattern for both row and column reordering here — no new drag-and-drop library needed.
- **The `CustomSection` schema** (`lib/schemas/resume.zod.ts` — `id`, `name`, `enabledFields`, `items`) is the closest existing precedent in this codebase for "a user-defined, flexibly-shaped collection of fields." The board's custom-column mechanism below is conceptually the same idea (user names a field, picks a type, it becomes usable) applied to a table's columns instead of a resume section's fields.
- **No custom `User` Mongoose model exists** — auth runs through `@auth/mongodb-adapter`, which manages its own `users`/`accounts`/`sessions` collections directly, not through a model this app controls. Do not attach board config to a "User" document. Store it as its own collection keyed by `userId: string`, the same way `Resume` is keyed today.
- **The recoverable-delete pattern** (`ResumeCard.tsx`'s optimistic-hide + 6-second undo toast) is the established convention for destructive actions in this app — reuse it for deleting an application row rather than inventing a new confirm-dialog pattern.

## Data model

### `Application` (new Mongoose model + Zod schema)

```ts
{
  _id
  userId: string        // owner, matches Resume's convention
  resumeId?: string      // which resume/version this application uses
  company: string
  role: string
  status: string          // references an option id in the user's status column config, not a hardcoded enum — status values are themselves user-customizable (colors, labels, count) per the "supertable" requirement
  order: number            // fractional-index style (e.g. start at 1000, insert at midpoints) so manual drag reordering never requires renumbering every row
  customFields: Record<string, string | number | boolean | null>  // keyed by column id, typed per that column's `type`
  createdAt, updatedAt
}
```

Why `status` is a plain string keyed against user-defined options rather than a fixed enum: the user explicitly asked for full customization ("add new attributes for his personal use") — hardcoding `draft/applied/interviewing/offer/rejected` (Sprint 5a's approach) is exactly the shallow pattern being replaced. Status becomes just another column of type `'status'`, whose options (label + color) live in the board config below, editable the same way any other select-type column's options are.

### `ApplicationActivity` (new Mongoose model — the audit log)

```ts
{
  _id
  applicationId: string
  userId: string
  field: string           // 'status' | 'company' | 'role' | 'resumeId' | a customFields column id
  fieldLabel: string      // denormalized display label at the time of the change, so renaming a column later doesn't rewrite history ("Recruiter Name" stays "Recruiter Name" in old log entries even if the column is later renamed)
  fromValue: string | null
  toValue: string | null
  changedAt: Date
}
```

One row per changed field per PATCH (a single request that changes both `status` and a custom field produces two activity rows, not one merged row) — keeps the log readable as a flat, chronological "X changed from Y to Z at time T" feed, matching the user's explicit ask for "logs of updates with timestamps and action made."

### `BoardConfig` (new Mongoose model — one document per user)

```ts
{
  userId: string
  columns: Array<{
    id: string             // stable id, referenced by Application.customFields keys and ApplicationActivity.field
    key: 'company' | 'role' | 'resumeId' | 'status' | string  // built-in keys are fixed strings; custom columns get a generated id
    label: string
    type: 'text' | 'number' | 'date' | 'url' | 'select' | 'status' | 'checkbox'
    isBuiltIn: boolean      // company/role/resumeId/status are built-in and can be reordered/hidden but not deleted; everything else is a user-added custom column and can be deleted
    order: number
    width?: number
    options?: Array<{ id: string; label: string; color: string }>  // only for 'select'/'status' types — user-defined values, e.g. status options are exactly this shape, so "status" is really just a built-in column of type 'select' with a starter set of options (Applied/Interviewing/Offer/Rejected) the user can rename, recolor, add to, or remove
  }>
  sort: Array<{ columnId: string; direction: 'asc' | 'desc' }>  // ordered list = multi-column sort; first entry is primary, second is the tiebreaker within the first, etc. — directly implements "sort columns, sort within a column(s)"
}
```

A user's very first visit auto-creates a default `BoardConfig` (company, role, status, resume-used, applied-date as built-in columns; status pre-seeded with Applied/Interviewing/Offer/Rejected options in a reasonable default color set) rather than requiring manual setup before the table is usable.

## API surface (new routes, all under `app/api/applications/`)

- `GET /api/applications` — list all of the user's applications, each with its resolved resume title (same `Map`-based no-N+1 pattern `listResumes` already uses for `parentResumeTitle`).
- `POST /api/applications` — create one (optionally pre-filled from a `resumeId`, pulling that resume's `targetCompany`/`targetRole` as initial values if present).
- `PATCH /api/applications/[id]` — update one or more fields; the handler diffs the incoming patch against the current document field-by-field and writes one `ApplicationActivity` row per actually-changed field (skip fields that were "changed" to the same value) inside the same request, before returning.
- `DELETE /api/applications/[id]` — delete (client handles the optimistic-hide + undo-toast UX, matching `ResumeCard.tsx`).
- `GET /api/applications/[id]/activity` — the change log for one application, newest first.
- `GET /api/applications/board-config` — fetch the user's config, auto-creating the default on first call.
- `PATCH /api/applications/board-config` — update columns (add/remove/reorder/rename/recolor options) and/or the sort spec.

Sorting and filtering happen **client-side**: a user's application list is realistically bounded (dozens, not thousands, of rows), so fetch the full list once and sort/filter in the browser — no server-side query-building complexity needed for v1. The sort spec still persists server-side (in `BoardConfig`) so it survives a reload.

## UI

- **New page:** `app/(dashboard)/dashboard/applications/page.tsx`, linked from the main dashboard nav alongside "My CVs."
- **`components/applications/ApplicationsTable.tsx`** — the core grid. Each column renders via a type-specific cell component (`TextCell`, `NumberCell`, `DateCell`, `UrlCell`, `SelectCell` — a colored chip with a dropdown to change value, `CheckboxCell`); all cells are inline-editable (click to edit, blur/enter to save via PATCH), no separate "edit mode."
- **Column header**: click to toggle sort (asc → desc → off); shift-click (or a small "+" affordance) adds it as a secondary sort level rather than replacing the primary one — the header shows a small numbered badge (①②③) when part of a multi-column sort so the active sort order is visible at a glance, not just inferred.
- **"+ Add column" control** at the end of the header row — opens a small form: name, type, and (for select/status types) an initial option list with color pickers. New columns get a generated `id` and append to `BoardConfig.columns`.
- **Row drag-and-drop** (dnd-kit, same `DndContext`/`SortableContext` shape as `EditTab.tsx`): only enabled when `sort` is empty (an active column sort and manual ordering are contradictory — dragging while sorted should either be disabled with a tooltip explaining why, or clear the sort on drag-start; pick the former, it's less surprising). Dragging updates `order` via a fractional-index recompute (only the moved row's `order` changes in the common case, not a full renumber).
- **Column drag-and-drop**: drag column headers to reorder; updates each column's `order` in `BoardConfig`.
- **Activity log**: a small "🕐" icon per row opens a lightweight popover/drawer listing that application's `ApplicationActivity` rows, newest first, formatted as `"{fieldLabel} changed from '{fromValue}' to '{toValue}' — {relative timestamp}"` (reuse the existing `formatRelativeTime` helper already in `ResumeCard.tsx`).
- **Entry points**: a "Track this application" action on `ResumeCard`/the resume editor that creates a new `Application` pre-filled with that `resumeId` (and the resume's `targetCompany`/`targetRole` if set) and navigates to the applications page; an empty state on the applications page itself (mirroring `EmptyDashboardState.tsx`'s pattern) for a user with zero applications, with a "+ New Application" CTA that doesn't require starting from a resume.
- **Deleting a column** (a user-added one — built-ins can't be deleted, only hidden/reordered): confirm first, since it discards that field's data across every row; on confirm, remove the column from `BoardConfig` and leave the now-orphaned `customFields` keys in each `Application` document alone (cheap, reversible if the user re-adds a column with the same generated id — simpler than a cleanup migration, and harmless dead data).

## Global constraints (for whoever executes this)

- No new npm dependencies — `@dnd-kit/*` already covers all drag-and-drop needs.
- Follow the recoverable-delete (optimistic-hide + undo toast) convention from `ResumeCard.tsx` for deleting applications; don't introduce a new confirm-dialog pattern for that specific action (column deletion is different — that one destroys data across every row silently if undone incorrectly, so a real confirm is appropriate there, not an undo-toast).
- Client-side sort/filter, server-persisted sort spec — don't build server-side query/pagination machinery for v1; this is a personal tracking tool, not a multi-tenant SaaS table with thousands of rows per user.
- Every `PATCH` to an application must produce accurate `ApplicationActivity` rows — this is a named, explicit requirement from the user, not a nice-to-have; a task's TDD tests should assert on the log content, not just on the field being updated.

## Suggested task breakdown (for whoever schedules this)

1. Zod schemas + Mongoose models: `Application`, `ApplicationActivity`, `BoardConfig` (including the default-config auto-creation logic).
2. Application CRUD routes (`GET`/`POST` list, `PATCH`/`DELETE` single) with the diff-and-log behavior on `PATCH`.
3. Board-config routes (`GET`/`PATCH`) including the add/remove/reorder/rename-column and option-editing logic.
4. `ApplicationsTable.tsx` core grid + type-specific cell renderers + inline editing, wired to a real (not yet sortable/draggable) list — get the basic table working end-to-end first.
5. Column header sort UI (single + multi-column) + client-side sort/filter logic.
6. Row drag-and-drop (fractional-index reordering, disabled while a column sort is active) + column header drag-and-drop.
7. "+ Add column" flow (type picker, option/color editor for select/status types) + column deletion with confirm.
8. Activity log popover/drawer UI + the `GET .../activity` route's consumption.
9. Entry points ("Track this application" from a resume, applications-page empty state) + final verification gate (`npx vitest run`, `npx tsc --noEmit`, `npm run build`).

## Open questions to resolve before scheduling

1. **Kanban/board view toggle** — the user asked for "a table grid," but a status-grouped board (drag cards between status columns, Trello-style) is a very natural companion view once `status` is just another select column. Worth a v1.5 addition, or deliberately out of scope?
2. **Multiple boards/views per user** — v1 above assumes one `BoardConfig` per user (one view of one column set). Real Monday.com-style tools let you save multiple named views (e.g. "By Status," "By Company," each with its own sort/filter/column-visibility). Worth it now, or single-view-only for v1?
3. **Filtering** — this doc designs sorting and custom columns in depth but only lightly touches filtering (e.g. "show only Interviewing + Offer"). Worth specifying as its own task, or fold into a v1.5?
