// lib/api/applications.ts
// Data access for the application-tracking supertable. The PATCH path is the
// heart of the feature's audit requirement: every actually-changed field
// produces one ApplicationActivity row (field-by-field diff, same request).
import dbConnect from '@/lib/db'
import Application from '@/models/Application'
import ApplicationActivity from '@/models/ApplicationActivity'
import Resume from '@/models/Resume'
import { getOrCreateBoardConfig } from '@/lib/api/board-config'
import type {
  BoardColumn,
  CreateApplicationInput,
  CustomFieldValue,
  PatchApplicationInput,
} from '@/lib/schemas/application.zod'

const ORDER_GAP = 1000

interface ApplicationRecord {
  _id: unknown
  userId: string
  resumeId?: string
  company: string
  role: string
  status: string
  order: number
  customFields?: Record<string, CustomFieldValue>
}

export async function listApplications(userId: string) {
  await dbConnect()
  const applications = (await Application.find({ userId })
    .sort({ order: 1 })
    .lean()) as unknown as ApplicationRecord[]

  // Same Map-based no-N+1 pattern as listResumes' parentResumeTitle: one
  // batched Resume query for all referenced ids, resolved in memory.
  const resumeIds = [...new Set(applications.map((a) => a.resumeId).filter(Boolean))] as string[]
  let titleById = new Map<string, string>()
  if (resumeIds.length > 0) {
    const resumes = (await Resume.find({ _id: { $in: resumeIds }, userId }, 'title').lean()) as unknown as Array<{
      _id: unknown
      title: string
    }>
    titleById = new Map(resumes.map((r) => [String(r._id), r.title]))
  }

  return applications.map((a) => ({
    ...a,
    resumeTitle: a.resumeId ? titleById.get(String(a.resumeId)) : undefined,
  }))
}

export async function createApplication(userId: string, input: CreateApplicationInput) {
  await dbConnect()

  let company = input.company
  let role = input.role
  if (input.resumeId) {
    const resume = (await Resume.findOne({ _id: input.resumeId, userId }).lean()) as {
      targetCompany?: string
      targetRole?: string
    } | null
    if (resume) {
      if (!company && resume.targetCompany) company = resume.targetCompany
      if (!role && resume.targetRole) role = resume.targetRole
    }
  }

  // Default status = first option of the user's status column, so a renamed/
  // reordered option set keeps producing valid values.
  let status = input.status
  if (!status) {
    const config = await getOrCreateBoardConfig(userId)
    const statusColumn = (config.columns as BoardColumn[]).find((c) => c.type === 'status')
    status = statusColumn?.options?.[0]?.id ?? 'applied'
  }

  const top = (await Application.findOne({ userId })
    .sort({ order: -1 })
    .lean()) as { order?: number } | null
  const order = (top?.order ?? 0) + ORDER_GAP

  const created = await Application.create({
    userId,
    resumeId: input.resumeId,
    company,
    role,
    status,
    order,
    customFields: input.customFields ?? {},
  })
  return created.toObject()
}

/** Formats a field value for the activity log: option ids become their display labels. */
function toActivityValue(value: unknown, column?: BoardColumn): string | null {
  if (value === undefined || value === null || value === '') return null
  if (column && (column.type === 'select' || column.type === 'status')) {
    const option = column.options?.find((o) => o.id === value)
    if (option) return option.label
  }
  return String(value)
}

export async function patchApplication(userId: string, id: string, patch: PatchApplicationInput) {
  await dbConnect()

  const current = (await Application.findOne({ _id: id, userId }).lean()) as ApplicationRecord | null
  if (!current) return null

  const config = await getOrCreateBoardConfig(userId)
  const columns = config.columns as BoardColumn[]
  const columnByKey = new Map(columns.map((c) => [c.key, c]))
  const columnById = new Map(columns.map((c) => [c.id, c]))

  const setPayload: Record<string, unknown> = {}
  const activityRows: Array<{
    applicationId: string
    userId: string
    field: string
    fieldLabel: string
    fromValue: string | null
    toValue: string | null
    changedAt: Date
  }> = []
  const changedAt = new Date()

  function logChange(field: string, fieldLabel: string, fromValue: string | null, toValue: string | null) {
    activityRows.push({ applicationId: id, userId, field, fieldLabel, fromValue, toValue, changedAt })
  }

  // --- Built-in scalar fields ---------------------------------------------
  const builtIns: Array<'company' | 'role' | 'status'> = ['company', 'role', 'status']
  for (const field of builtIns) {
    const next = patch[field]
    if (next === undefined) continue
    setPayload[field] = next
    if (next === current[field]) continue
    const column = columnByKey.get(field)
    logChange(
      field,
      column?.label ?? field,
      toActivityValue(current[field], column),
      toActivityValue(next, column)
    )
  }

  // --- resumeId (logged as resume titles for a readable feed) --------------
  if (patch.resumeId !== undefined) {
    const next = patch.resumeId ?? undefined
    setPayload.resumeId = patch.resumeId
    if (next !== current.resumeId) {
      const ids = [current.resumeId, next].filter(Boolean) as string[]
      let titleById = new Map<string, string>()
      if (ids.length > 0) {
        const resumes = (await Resume.find({ _id: { $in: ids }, userId }, 'title').lean()) as unknown as Array<{
          _id: unknown
          title: string
        }>
        titleById = new Map(resumes.map((r) => [String(r._id), r.title]))
      }
      const column = columnByKey.get('resumeId')
      logChange(
        'resumeId',
        column?.label ?? 'Resume',
        current.resumeId ? titleById.get(String(current.resumeId)) ?? String(current.resumeId) : null,
        next ? titleById.get(String(next)) ?? String(next) : null
      )
    }
  }

  // --- order (manual drag position — internal plumbing, never logged) ------
  if (patch.order !== undefined) {
    setPayload.order = patch.order
  }

  // --- custom fields (merged per key) ---------------------------------------
  if (patch.customFields !== undefined) {
    for (const [key, next] of Object.entries(patch.customFields)) {
      setPayload[`customFields.${key}`] = next
      const prev = current.customFields?.[key]
      if (next === prev || (next === null && prev === undefined)) continue
      const column = columnById.get(key)
      logChange(
        key,
        column?.label ?? key,
        toActivityValue(prev, column),
        toActivityValue(next, column)
      )
    }
  }

  const updated = await Application.findOneAndUpdate(
    { _id: id, userId },
    { $set: setPayload },
    { new: true }
  ).lean()

  if (updated && activityRows.length > 0) {
    await ApplicationActivity.insertMany(activityRows)
  }

  return updated
}

export async function deleteApplication(userId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await Application.deleteOne({ _id: id, userId })
  if (result.deletedCount === 0) return false
  // Cascade: an orphaned activity log is unreachable once its row is gone.
  await ApplicationActivity.deleteMany({ applicationId: id, userId })
  return true
}

export async function listActivity(userId: string, applicationId: string) {
  await dbConnect()
  return ApplicationActivity.find({ applicationId, userId }).sort({ changedAt: -1, _id: -1 }).lean()
}
