'use client'

// The core supertable grid: one row per application, one column per
// BoardConfig column, all cells inline-editable via type-specific renderers.
// Rows and column headers are drag-reorderable via dnd-kit (the same
// DndContext/SortableContext pattern as EditTab.tsx); row dragging is
// disabled while a column sort is active, since manual ordering and an
// active sort are contradictory.
import { memo } from 'react'
import {
  DndContext,
  closestCenter,
  type Announcements,
  type DragEndEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { BoardColumn, CustomFieldValue, SortEntry } from '@/lib/schemas/application.zod'
import type { ApplicationRow, ResumeOption } from '@/lib/applications/types'
import { getCellValue, isColumnEditable } from '@/lib/applications/cells'
import {
  TextCell,
  NumberCell,
  DateCell,
  UrlCell,
  SelectCell,
  CheckboxCell,
  ResumeCell,
} from './cells'

const DEFAULT_COLUMN_WIDTH = 160
const GRIP_COLUMN_WIDTH = 28

export const ApplicationCell = memo(function ApplicationCell({
  app,
  column,
  resumes,
  onCellChange,
}: {
  app: ApplicationRow
  column: BoardColumn
  resumes: ResumeOption[]
  onCellChange: (appId: string, column: BoardColumn, value: CustomFieldValue) => void
}) {
  const value = getCellValue(app, column)
  const ariaLabel = `${column.label} for ${app.company || 'application'}`
  const onCommit = (next: CustomFieldValue) => onCellChange(app._id, column, next)

  if (column.key === 'resumeId') {
    return (
      <ResumeCell
        value={value}
        onCommit={onCommit}
        ariaLabel={ariaLabel}
        resumes={resumes}
        resumeTitle={app.resumeTitle}
      />
    )
  }
  if (!isColumnEditable(column)) {
    return <DateCell value={value} onCommit={onCommit} ariaLabel={ariaLabel} readOnly />
  }
  switch (column.type) {
    case 'number':
      return <NumberCell value={value} onCommit={onCommit} ariaLabel={ariaLabel} />
    case 'date':
      return <DateCell value={value} onCommit={onCommit} ariaLabel={ariaLabel} />
    case 'url':
      return <UrlCell value={value} onCommit={onCommit} ariaLabel={ariaLabel} />
    case 'checkbox':
      return <CheckboxCell value={value} onCommit={onCommit} ariaLabel={ariaLabel} />
    case 'select':
    case 'status':
      return (
        <SelectCell
          value={value}
          onCommit={onCommit}
          ariaLabel={ariaLabel}
          options={column.options ?? []}
        />
      )
    default:
      return <TextCell value={value} onCommit={onCommit} ariaLabel={ariaLabel} />
  }
})

export function columnWidth(column: BoardColumn): number {
  return column.width ?? DEFAULT_COLUMN_WIDTH
}

// Mirrors ApplicationsBoard's screenReaderInstructions/announcements pattern
// (also copied by DesignPanel and ListFieldManager). These were the last two
// DndContexts in the app with neither: dnd-kit's silent default leaves a
// keyboard user with no idea what they picked up, where it is, or whether the
// drop landed — and the table has two independent reorderings, so "moved to
// position 3" alone would be ambiguous between rows and columns.

const columnDragInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder a column: press space or enter to pick it up, use the left and right arrow keys to move it, then press space or enter again to drop it. Press escape to cancel.',
}

const rowDragInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder an application: press space or enter to pick it up, use the up and down arrow keys to move it, then press space or enter again to drop it. Press escape to cancel.',
}

function buildColumnAnnouncements(columns: BoardColumn[]): Announcements {
  const label = (id: string) => columns.find((c) => c.id === id)?.label ?? 'a column'
  const position = (id: string) => {
    const i = columns.findIndex((c) => c.id === id)
    return i === -1 ? '' : ` (position ${i + 1} of ${columns.length})`
  }
  return {
    onDragStart: ({ active }) => `Picked up the ${label(String(active.id))} column${position(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `The ${label(String(active.id))} column is over the ${label(String(over.id))} column${position(String(over.id))}.`
        : `The ${label(String(active.id))} column is no longer over a drop target.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `The ${label(String(active.id))} column was dropped at ${label(String(over.id))}'s place${position(String(over.id))}.`
        : `The ${label(String(active.id))} column was dropped where it started.`,
    onDragCancel: ({ active }) => `Reordering the ${label(String(active.id))} column was cancelled.`,
  }
}

function buildRowAnnouncements(applications: ApplicationRow[]): Announcements {
  const describe = (id: string) => {
    const app = applications.find((a) => a._id === id)
    if (!app) return 'the application'
    return app.company ? `the application at ${app.company}` : 'the untitled application'
  }
  const position = (id: string) => {
    const i = applications.findIndex((a) => a._id === id)
    return i === -1 ? '' : ` (row ${i + 1} of ${applications.length})`
  }
  return {
    onDragStart: ({ active }) => `Picked up ${describe(String(active.id))}${position(String(active.id))}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${describe(String(active.id))} is over ${describe(String(over.id))}${position(String(over.id))}.`
        : `${describe(String(active.id))} is no longer over a drop target.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${describe(String(active.id))} was dropped at ${describe(String(over.id))}'s place${position(String(over.id))}.`
        : `${describe(String(active.id))} was dropped where it started.`,
    onDragCancel: ({ active }) => `Reordering ${describe(String(active.id))} was cancelled.`,
  }
}

/**
 * ARIA asks that at most one header carry a sort direction at a time, so a
 * multi-level sort exposes only its primary level. Every other column reports
 * "none", which is what tells assistive technology the column is sortable at
 * all rather than merely unsorted.
 */
function ariaSortFor(columnId: string, sort: SortEntry[]): 'ascending' | 'descending' | 'none' {
  const primary = sort[0]
  if (!primary || primary.columnId !== columnId) return 'none'
  return primary.direction === 'asc' ? 'ascending' : 'descending'
}

function SortableHeaderCell({
  column,
  ariaSort,
  children,
}: {
  column: BoardColumn
  /**
   * Read by a screen reader's table mode, which is where a blind user learns
   * how the grid is ordered. The sort *button* already announced direction in
   * its label, but that only helps someone who has navigated onto the button;
   * aria-sort belongs on the columnheader itself.
   */
  ariaSort: 'ascending' | 'descending' | 'none'
  children: React.ReactNode
}) {
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  })
  return (
    <div
      ref={setNodeRef}
      role="columnheader"
      aria-sort={ariaSort}
      style={{
        width: columnWidth(column),
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`flex shrink-0 items-center gap-0.5 border-r border-indigo-50 px-1 py-2 ${
        isDragging ? 'z-10 rounded bg-indigo-50 opacity-80 shadow' : ''
      }`}
    >
      <button
        type="button"
        aria-label={`Reorder ${column.label} column`}
        title="Drag to reorder column"
        {...attributes}
        {...listeners}
        className="shrink-0 cursor-grab touch-none rounded px-0.5 text-fg-subtle hover:text-fg-body active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function SortableRow({
  app,
  dragDisabled,
  children,
}: {
  app: ApplicationRow
  dragDisabled: boolean
  children: React.ReactNode
}) {
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({
    id: app._id,
    disabled: dragDisabled,
  })
  return (
    <div
      ref={setNodeRef}
      role="row"
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group/row flex border-b border-indigo-50 transition hover:bg-indigo-50/40 ${
        isDragging ? 'relative z-10 rounded bg-white opacity-90 shadow-lg' : ''
      }`}
    >
      <div
        role="cell"
        style={{ width: GRIP_COLUMN_WIDTH }}
        className="flex shrink-0 items-center justify-center"
      >
        <button
          type="button"
          aria-label={`Reorder application at ${app.company || 'unknown company'}`}
          disabled={dragDisabled}
          title={
            dragDisabled
              ? 'Clear column sorting to reorder rows manually'
              : 'Drag to reorder'
          }
          {...(dragDisabled ? {} : { ...attributes, ...listeners })}
          className={`touch-none rounded px-0.5 text-sm ${
            dragDisabled
              ? 'cursor-not-allowed text-indigo-200'
              : 'cursor-grab text-fg-subtle opacity-0 transition group-hover/row:opacity-100 hover:text-fg-body focus:opacity-100 active:cursor-grabbing'
          }`}
        >
          <GripVertical className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
      {children}
    </div>
  )
}

export interface ApplicationsTableProps {
  applications: ApplicationRow[]
  columns: BoardColumn[]
  resumes: ResumeOption[]
  onCellChange: (appId: string, column: BoardColumn, value: CustomFieldValue) => void
  onDeleteRow: (appId: string) => void
  /** Drop handlers for drag reordering. Row dragging only fires when rowDragEnabled. */
  onRowMove?: (activeId: string, overId: string) => void
  onColumnMove?: (activeId: string, overId: string) => void
  /** False while a column sort is active — manual order and sorting conflict. */
  rowDragEnabled?: boolean
  /**
   * Current sort, purely so the header cells can expose `aria-sort`. The table
   * receives already-sorted rows; it does not sort anything itself.
   */
  sort?: SortEntry[]
  /** Per-row trailing accessory (activity-log trigger etc.), rendered in the actions cell. */
  renderRowAccessory?: (app: ApplicationRow) => React.ReactNode
  /** Header decoration/behavior injection point (sort controls). */
  renderHeaderCell?: (column: BoardColumn) => React.ReactNode
  /** Trailing header accessory ("+ Add column"). */
  headerAccessory?: React.ReactNode
}

export default function ApplicationsTable({
  applications,
  columns,
  resumes,
  onCellChange,
  onDeleteRow,
  onRowMove,
  onColumnMove,
  rowDragEnabled = false,
  sort = [],
  renderRowAccessory,
  renderHeaderCell,
  headerAccessory,
}: ApplicationsTableProps) {
  const ordered = [...columns].sort((a, b) => a.order - b.order)

  function handleColumnDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onColumnMove?.(String(active.id), String(over.id))
  }

  function handleRowDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    onRowMove?.(String(active.id), String(over.id))
  }

  return (
    <div className="min-h-[28rem] overflow-x-auto rounded-xl border border-white/30 bg-white/65 shadow-lg backdrop-blur-xl">
      <div role="table" aria-label="Applications" className="min-w-max">
        {/* Header (columns are drag-reorderable) */}
        <DndContext
          id="applications-table-columns"
          collisionDetection={closestCenter}
          onDragEnd={handleColumnDragEnd}
          accessibility={{
            announcements: buildColumnAnnouncements(ordered),
            screenReaderInstructions: columnDragInstructions,
          }}
        >
          <SortableContext items={ordered.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div role="row" className="sticky top-0 z-10 flex border-b border-indigo-100 bg-white">
              <div role="columnheader" style={{ width: GRIP_COLUMN_WIDTH }} className="shrink-0" />
              {ordered.map((column) => (
                <SortableHeaderCell
                  key={column.id}
                  column={column}
                  ariaSort={ariaSortFor(column.id, sort)}
                >
                  {renderHeaderCell ? (
                    renderHeaderCell(column)
                  ) : (
                    <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
                      {column.label}
                    </span>
                  )}
                </SortableHeaderCell>
              ))}
              <div role="columnheader" className="flex w-24 shrink-0 items-center px-2 py-1">
                {headerAccessory}
              </div>
            </div>
          </SortableContext>
        </DndContext>

        {/* Rows (drag-reorderable while no column sort is active) */}
        <DndContext
          id="applications-table-rows"
          collisionDetection={closestCenter}
          onDragEnd={handleRowDragEnd}
          accessibility={{
            announcements: buildRowAnnouncements(applications),
            screenReaderInstructions: rowDragInstructions,
          }}
        >
          <SortableContext
            items={applications.map((a) => a._id)}
            strategy={verticalListSortingStrategy}
          >
            {applications.map((app) => (
              <SortableRow key={app._id} app={app} dragDisabled={!rowDragEnabled}>
                {ordered.map((column) => (
                  <div
                    key={column.id}
                    role="cell"
                    style={{ width: columnWidth(column) }}
                    className="group/cell flex shrink-0 items-center border-r border-indigo-50 px-0.5 py-1"
                  >
                    <div className="min-w-0 flex-1">
                      <ApplicationCell
                        app={app}
                        column={column}
                        resumes={resumes}
                        onCellChange={onCellChange}
                      />
                    </div>
                  </div>
                ))}
                <div
                  role="cell"
                  className="flex w-24 shrink-0 items-center justify-end gap-1 px-2 py-1"
                >
                  {renderRowAccessory?.(app)}
                  <button
                    type="button"
                    aria-label={`Delete application at ${app.company || 'unknown company'}`}
                    onClick={() => onDeleteRow(app._id)}
                    className="rounded px-1.5 py-0.5 text-xs text-red-400 opacity-0 transition group-hover/row:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100"
                    title="Delete"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </SortableRow>
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}
