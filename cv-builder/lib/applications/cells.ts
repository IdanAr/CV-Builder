// lib/applications/cells.ts
// Pure value plumbing between an ApplicationRow document and a BoardColumn:
// where a cell's value lives and what PATCH body an edit produces.
import type { BoardColumn, CustomFieldValue } from '@/lib/schemas/application.zod'
import type { PatchApplicationInput } from '@/lib/schemas/application.zod'
import type { ApplicationRow } from './types'

export function getCellValue(app: ApplicationRow, column: BoardColumn): CustomFieldValue {
  switch (column.key) {
    case 'company':
      return app.company
    case 'role':
      return app.role
    case 'status':
      return app.status
    case 'resumeId':
      return app.resumeId ?? null
    case 'createdAt':
      return app.createdAt
    default:
      return app.customFields?.[column.id] ?? null
  }
}

/** Read-only columns (system timestamps) never produce a patch. */
export function isColumnEditable(column: BoardColumn): boolean {
  return column.key !== 'createdAt'
}

/**
 * Builds the PATCH body for editing this column to `value`.
 * Returns null when the column is not editable.
 */
export function buildCellPatch(
  column: BoardColumn,
  value: CustomFieldValue
): PatchApplicationInput | null {
  if (!isColumnEditable(column)) return null
  switch (column.key) {
    case 'company':
      return { company: String(value ?? '') }
    case 'role':
      return { role: String(value ?? '') }
    case 'status':
      return { status: String(value ?? '') }
    case 'resumeId':
      return { resumeId: value === null || value === '' ? null : String(value) }
    default:
      return { customFields: { [column.id]: value } }
  }
}
