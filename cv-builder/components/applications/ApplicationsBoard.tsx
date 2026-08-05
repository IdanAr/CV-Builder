'use client'

// Kanban view: one column per option of the board's status-type column (so a
// renamed/recolored option set is reflected automatically — no hardcoded
// enum). Cross-container card drag PATCHes the application's status through
// the same diff-and-log handler as any other edit, so Kanban moves produce
// activity rows with no separate logging path.
import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  type DragStartEvent,
  type DragEndEvent,
  type Announcements,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BoardColumn, ColumnOption } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '@/lib/applications/types'

const COLUMN_DROPPABLE_PREFIX = 'status:'

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'To move an application to a different status column: press space or enter to pick it up, use the arrow keys to move it over a column or another card, then press space or enter again to drop it. Press escape to cancel.',
}

function describeCard(appId: string, applications: ApplicationRow[]): string {
  const app = applications.find((a) => a._id === appId)
  return app?.company ? `the application at ${app.company}` : 'the application'
}

function describeTarget(
  overId: string | null,
  applications: ApplicationRow[],
  options: ColumnOption[]
): string {
  if (!overId) return 'outside any column'
  if (overId.startsWith(COLUMN_DROPPABLE_PREFIX)) {
    const statusId = overId.slice(COLUMN_DROPPABLE_PREFIX.length)
    const option = options.find((o) => o.id === statusId)
    return option ? `the ${option.label} column` : 'a column'
  }
  const overApp = applications.find((a) => a._id === overId)
  return overApp ? `next to the application at ${overApp.company || 'unknown company'}` : 'another card'
}

function buildAnnouncements(applications: ApplicationRow[], options: ColumnOption[]): Announcements {
  return {
    onDragStart({ active }) {
      return `Picked up ${describeCard(String(active.id), applications)}.`
    },
    onDragOver({ active, over }) {
      const card = describeCard(String(active.id), applications)
      return over ? `${card} is over ${describeTarget(String(over.id), applications, options)}.` : `${card} is no longer over a droppable area.`
    },
    onDragEnd({ active, over }) {
      const card = describeCard(String(active.id), applications)
      return over ? `${card} was moved to ${describeTarget(String(over.id), applications, options)}.` : `${card} was dropped.`
    },
    onDragCancel({ active }) {
      return `Moving ${describeCard(String(active.id), applications)} was cancelled.`
    },
  }
}

function CardContent({ app, customChips }: { app: ApplicationRow; customChips: string[] }) {
  return (
    <>
      <p className="truncate text-sm font-semibold text-indigo-900">
        {app.company || <span className="text-indigo-300">No company</span>}
      </p>
      {app.role && <p className="mt-0.5 truncate text-xs text-indigo-500">{app.role}</p>}
      {app.resumeTitle && (
        <p className="mt-1 truncate text-xs text-indigo-400">📄 {app.resumeTitle}</p>
      )}
      {customChips.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {customChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-600"
            >
              {chip}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

function BoardCard({ app, customChips }: { app: ApplicationRow; customChips: string[] }) {
  // role: 'listitem' matches the lane's role="list" container — passed as a
  // dnd-kit attributes option (rather than overridden via JSX spread order)
  // so dnd-kit itself skips the button-only aria-pressed it would otherwise add.
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app._id,
    attributes: { role: 'listitem' },
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-label={`Application at ${app.company || 'unknown company'}`}
      // While this card is the one being dragged, it becomes a faint in-place
      // placeholder — the actual "floating" card the user sees under the
      // cursor is the DragOverlay clone below, which is what makes cross-
      // column dragging read as one continuous motion instead of the list
      // just reflowing around a half-visible original.
      className={`cursor-grab touch-none rounded-lg border border-indigo-100 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow ${
        isDragging ? 'opacity-30' : ''
      }`}
    >
      <CardContent app={app} customChips={customChips} />
    </div>
  )
}

function BoardCardOverlay({ app, customChips }: { app: ApplicationRow; customChips: string[] }) {
  return (
    <div className="w-64 rotate-2 cursor-grabbing rounded-lg border border-indigo-200 bg-white p-3 shadow-2xl ring-2 ring-indigo-300">
      <CardContent app={app} customChips={customChips} />
    </div>
  )
}

function BoardColumnLane({
  option,
  cards,
  customChipsFor,
}: {
  option: ColumnOption
  cards: ApplicationRow[]
  customChipsFor: (app: ApplicationRow) => string[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${COLUMN_DROPPABLE_PREFIX}${option.id}` })
  return (
    <div className="flex w-64 shrink-0 flex-col" role="group" aria-label={`${option.label} column`}>
      <div className="mb-2 flex items-center gap-2 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.color }} />
        <span className="text-xs font-semibold uppercase tracking-wide text-indigo-500">
          {option.label}
        </span>
        <span className="text-xs text-indigo-300">{cards.length}</span>
      </div>
      <SortableContext items={cards.map((c) => c._id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          role="list"
          className={`flex min-h-24 flex-1 flex-col gap-2 rounded-xl border p-2 transition ${
            isOver ? 'border-indigo-300 bg-indigo-50/60' : 'border-white/40 bg-white/40'
          }`}
        >
          {cards.map((app) => (
            <BoardCard key={app._id} app={app} customChips={customChipsFor(app)} />
          ))}
        </div>
      </SortableContext>
    </div>
  )
}

export interface ApplicationsBoardProps {
  applications: ApplicationRow[]
  columns: BoardColumn[]
  /** Drop handler: overCardId is null when dropped on a column's empty area. */
  onCardMove: (appId: string, targetStatus: string, overCardId: string | null) => void
}

export default function ApplicationsBoard({
  applications,
  columns,
  onCardMove,
}: ApplicationsBoardProps) {
  const statusColumn = columns.find((c) => c.type === 'status')
  const options = statusColumn?.options ?? []
  const optionIds = new Set(options.map((o) => o.id))
  const [activeId, setActiveId] = useState<string | null>(null)
  // A tiny movement threshold before a drag activates, so a plain click/tap
  // never gets mistaken for the start of a drag — without this, the default
  // sensor starts dragging on the very first pixel of pointer movement,
  // which is what made the interaction feel twitchy rather than deliberate.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Chips for custom select columns with a set value (readable at a glance).
  function customChipsFor(app: ApplicationRow): string[] {
    return columns
      .filter((c) => !c.isBuiltIn && c.type === 'select')
      .map((c) => c.options?.find((o) => o.id === app.customFields?.[c.id])?.label)
      .filter((label): label is string => label !== undefined)
  }

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(String(active.id))
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return
    const appId = String(active.id)
    const overId = String(over.id)
    if (appId === overId) return
    if (overId.startsWith(COLUMN_DROPPABLE_PREFIX)) {
      const targetStatus = overId.slice(COLUMN_DROPPABLE_PREFIX.length)
      // The synthetic "No status" lane is display-only, not a drop target.
      if (optionIds.has(targetStatus)) onCardMove(appId, targetStatus, null)
      return
    }
    const overApp = applications.find((a) => a._id === overId)
    if (!overApp || !optionIds.has(overApp.status)) return
    onCardMove(appId, overApp.status, overId)
  }

  function handleDragCancel() {
    setActiveId(null)
  }

  if (!statusColumn || options.length === 0) {
    return (
      <p className="rounded-xl border border-indigo-100 bg-white/50 p-6 text-sm text-indigo-400">
        The board view needs a status column with at least one option.
      </p>
    )
  }

  const grouped = new Map<string, ApplicationRow[]>(options.map((o) => [o.id, []]))
  const unmatched: ApplicationRow[] = []
  for (const app of [...applications].sort((a, b) => a.order - b.order)) {
    if (optionIds.has(app.status)) grouped.get(app.status)!.push(app)
    else unmatched.push(app)
  }

  const announcements = buildAnnouncements(applications, options)
  const activeApp = activeId ? applications.find((a) => a._id === activeId) ?? null : null

  return (
    <div className="overflow-x-auto pb-2">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
        accessibility={{ announcements, screenReaderInstructions }}
      >
        <div className="flex items-stretch gap-3">
          {options.map((option) => (
            <BoardColumnLane
              key={option.id}
              option={option}
              cards={grouped.get(option.id) ?? []}
              customChipsFor={customChipsFor}
            />
          ))}
          {unmatched.length > 0 && (
            <BoardColumnLane
              option={{ id: '__unmatched', label: 'No status', color: '#94a3b8' }}
              cards={unmatched}
              customChipsFor={customChipsFor}
            />
          )}
        </div>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.2, 0, 0, 1)' }}>
          {activeApp ? <BoardCardOverlay app={activeApp} customChips={customChipsFor(activeApp)} /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
