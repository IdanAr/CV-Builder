'use client'

// Kanban view: one column per option of the board's status-type column (so a
// renamed/recolored option set is reflected automatically — no hardcoded
// enum). Cross-container card drag PATCHes the application's status through
// the same diff-and-log handler as any other edit, so Kanban moves produce
// activity rows with no separate logging path.
import { DndContext, closestCorners, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { BoardColumn, ColumnOption } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from '@/lib/applications/types'

const COLUMN_DROPPABLE_PREFIX = 'status:'

function BoardCard({ app, customChips }: { app: ApplicationRow; customChips: string[] }) {
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app._id,
  })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="listitem"
      aria-label={`Application at ${app.company || 'unknown company'}`}
      className={`cursor-grab touch-none rounded-lg border border-indigo-100 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow ${
        isDragging ? 'z-10 opacity-80 shadow-lg' : ''
      }`}
    >
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

  // Chips for custom select columns with a set value (readable at a glance).
  function customChipsFor(app: ApplicationRow): string[] {
    return columns
      .filter((c) => !c.isBuiltIn && c.type === 'select')
      .map((c) => c.options?.find((o) => o.id === app.customFields?.[c.id])?.label)
      .filter((label): label is string => label !== undefined)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
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

  return (
    <div className="overflow-x-auto pb-2">
      <DndContext collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
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
      </DndContext>
    </div>
  )
}
