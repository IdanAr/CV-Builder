'use client'

// The core supertable grid: one row per application, one column per
// BoardConfig column, all cells inline-editable via type-specific renderers.
// Rows and column headers are drag-reorderable via dnd-kit (the same
// DndContext/SortableContext pattern as EditTab.tsx); row dragging is
// disabled while a column sort is active, since manual ordering and an
// active sort are contradictory.
import { memo } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X } from 'lucide-react'
import type { BoardColumn, CustomFieldValue } from '@/lib/schemas/application.zod'
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

function SortableHeaderCell({
  column,
  children,
}: {
  column: BoardColumn
  children: React.ReactNode
}) {
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  })
  return (
    <div
      ref={setNodeRef}
      role="columnheader"
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
        <DndContext id="applications-table-columns" collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
          <SortableContext items={ordered.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <div role="row" className="sticky top-0 z-10 flex border-b border-indigo-100 bg-white">
              <div role="columnheader" style={{ width: GRIP_COLUMN_WIDTH }} className="shrink-0" />
              {ordered.map((column) => (
                <SortableHeaderCell key={column.id} column={column}>
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
        <DndContext id="applications-table-rows" collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
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
