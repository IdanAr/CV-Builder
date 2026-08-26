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

/** Fixed ids for the custom columns job-search's "Mark as applied" writes into. */
export const JOB_URL_COLUMN_ID = 'jobUrl'
export const JOB_LOCATION_COLUMN_ID = 'jobLocation'

// Auto-provisions the "Job URL"/"Location" custom columns the first time a
// scraped posting is converted to an application, so that conversion's
// customFields (keyed by these fixed ids) actually render as real columns in
// the user's table instead of being invisible, orphaned keys — the same
// failure mode a customFields write against a never-configured column id
// would otherwise produce. Idempotent: a user who already has a column with
// one of these ids (e.g. re-running after a previous conversion) is left
// untouched rather than appended a duplicate.
export async function ensureJobMetadataColumns(userId: string): Promise<void> {
  const config = await getOrCreateBoardConfig(userId)
  const columns = config.columns as BoardColumn[]
  const existingIds = new Set(columns.map((c) => c.id))
  const missing: BoardColumn[] = []
  const maxOrder = columns.reduce((max, c) => Math.max(max, c.order), 0)

  if (!existingIds.has(JOB_URL_COLUMN_ID)) {
    missing.push({
      id: JOB_URL_COLUMN_ID,
      key: JOB_URL_COLUMN_ID,
      label: 'Job URL',
      type: 'url',
      isBuiltIn: false,
      order: maxOrder + 1000,
    })
  }
  if (!existingIds.has(JOB_LOCATION_COLUMN_ID)) {
    missing.push({
      id: JOB_LOCATION_COLUMN_ID,
      key: JOB_LOCATION_COLUMN_ID,
      label: 'Location',
      type: 'text',
      isBuiltIn: false,
      order: maxOrder + 2000,
    })
  }
  if (missing.length === 0) return

  await patchBoardConfig(userId, { columns: [...columns, ...missing] })
}
