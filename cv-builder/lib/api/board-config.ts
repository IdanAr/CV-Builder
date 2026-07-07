// lib/api/board-config.ts
// Per-user board configuration for the applications supertable: column set
// (built-in + user-defined) and the persisted multi-column sort spec.
import dbConnect from '@/lib/db'
import BoardConfig from '@/models/BoardConfig'
import {
  BUILT_IN_COLUMN_IDS,
  defaultBoardColumns,
  type BoardColumn,
  type PatchBoardConfigInput,
} from '@/lib/schemas/application.zod'

export async function getOrCreateBoardConfig(userId: string) {
  await dbConnect()
  const existing = await BoardConfig.findOne({ userId }).lean()
  if (existing) return existing
  const created = await BoardConfig.create({
    userId,
    columns: defaultBoardColumns(),
    sort: [],
  })
  return created.toObject()
}

/** Thrown for column-invariant violations; routes map it to a 400, not a 500. */
export class BoardConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BoardConfigValidationError'
  }
}

/**
 * Validates invariants a raw Zod shape-check can't express:
 * built-ins are never deleted, ids stay unique, select/status columns keep at
 * least one option, and at least one status-type column survives (the Kanban
 * view groups by it).
 */
function assertColumnsValid(columns: BoardColumn[]): void {
  const ids = new Set(columns.map((c) => c.id))
  if (ids.size !== columns.length) {
    throw new BoardConfigValidationError('Board config contains duplicate column ids')
  }
  for (const builtInId of BUILT_IN_COLUMN_IDS) {
    if (!ids.has(builtInId)) {
      throw new BoardConfigValidationError(`Built-in column "${builtInId}" cannot be deleted`)
    }
  }
  for (const col of columns) {
    if ((col.type === 'select' || col.type === 'status') && !(col.options && col.options.length > 0)) {
      throw new BoardConfigValidationError(`Column "${col.label}" needs at least one option`)
    }
  }
  if (!columns.some((c) => c.type === 'status')) {
    throw new BoardConfigValidationError('At least one status column is required')
  }
}

export async function patchBoardConfig(userId: string, patch: PatchBoardConfigInput) {
  if (patch.columns !== undefined) assertColumnsValid(patch.columns)

  await dbConnect()
  const setPayload: Record<string, unknown> = {}
  if (patch.columns !== undefined) setPayload.columns = patch.columns
  if (patch.sort !== undefined) setPayload.sort = patch.sort

  return BoardConfig.findOneAndUpdate({ userId }, { $set: setPayload }, { new: true }).lean()
}
