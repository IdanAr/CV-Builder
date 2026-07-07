'use client'

// The core supertable grid: one row per application, one column per
// BoardConfig column, all cells inline-editable via type-specific renderers.
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

export function ApplicationCell({
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
}

export interface ApplicationsTableProps {
  applications: ApplicationRow[]
  columns: BoardColumn[]
  resumes: ResumeOption[]
  onCellChange: (appId: string, column: BoardColumn, value: CustomFieldValue) => void
  onDeleteRow: (appId: string) => void
  onAddRow: () => void
  /** Per-row trailing accessory (activity-log trigger etc.), rendered in the actions cell. */
  renderRowAccessory?: (app: ApplicationRow) => React.ReactNode
  /** Header decoration/behavior injection point (sort controls, drag handles). */
  renderHeaderCell?: (column: BoardColumn) => React.ReactNode
  /** Optional row wrapper (drag-and-drop). Defaults to a plain div row. */
  renderRow?: (app: ApplicationRow, rowContent: React.ReactNode) => React.ReactNode
  /** Trailing header accessory ("+ Add column"). */
  headerAccessory?: React.ReactNode
}

export function columnWidth(column: BoardColumn): number {
  return column.width ?? DEFAULT_COLUMN_WIDTH
}

export default function ApplicationsTable({
  applications,
  columns,
  resumes,
  onCellChange,
  onDeleteRow,
  onAddRow,
  renderRowAccessory,
  renderHeaderCell,
  renderRow,
  headerAccessory,
}: ApplicationsTableProps) {
  const ordered = [...columns].sort((a, b) => a.order - b.order)

  return (
    <div className="overflow-x-auto rounded-xl border border-white/30 bg-white/65 shadow-lg backdrop-blur-xl">
      <div role="table" aria-label="Applications" className="min-w-max">
        {/* Header */}
        <div role="row" className="flex border-b border-indigo-100 bg-white/70">
          {ordered.map((column) => (
            <div
              key={column.id}
              role="columnheader"
              style={{ width: columnWidth(column) }}
              className="shrink-0 border-r border-indigo-50 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-indigo-500"
            >
              {renderHeaderCell ? renderHeaderCell(column) : column.label}
            </div>
          ))}
          <div role="columnheader" className="flex w-24 shrink-0 items-center px-2 py-1">
            {headerAccessory}
          </div>
        </div>

        {/* Rows */}
        {applications.map((app) => {
          const rowContent = (
            <>
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
              <div role="cell" className="flex w-24 shrink-0 items-center justify-end gap-1 px-2 py-1">
                {renderRowAccessory?.(app)}
                <button
                  type="button"
                  aria-label={`Delete application at ${app.company || 'unknown company'}`}
                  onClick={() => onDeleteRow(app._id)}
                  className="rounded px-1.5 py-0.5 text-xs text-red-400 opacity-0 transition group-hover/row:opacity-100 hover:bg-red-50 hover:text-red-600 focus:opacity-100"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </>
          )

          const plainRow = (
            <div
              key={app._id}
              role="row"
              className="group/row flex border-b border-indigo-50 transition hover:bg-indigo-50/40"
            >
              {rowContent}
            </div>
          )

          return renderRow ? (
            <div key={app._id} role="row" className="group/row border-b border-indigo-50">
              {renderRow(app, rowContent)}
            </div>
          ) : (
            plainRow
          )
        })}

        {/* Quick-add row */}
        <div role="row" className="flex">
          <button
            type="button"
            onClick={onAddRow}
            className="w-full px-3 py-2 text-left text-sm font-medium text-indigo-500 transition hover:bg-indigo-50/60 hover:text-indigo-700"
          >
            + New application
          </button>
        </div>
      </div>
    </div>
  )
}
