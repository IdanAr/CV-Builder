// lib/schemas/application.zod.ts
// Zod schemas for the application-tracking supertable (Sprint 6):
// Application rows, the per-user BoardConfig (columns + multi-sort spec),
// and the ApplicationActivity change log.
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Column model
// ---------------------------------------------------------------------------

export const COLUMN_TYPES = ['text', 'number', 'date', 'url', 'select', 'status', 'checkbox'] as const
export const ColumnTypeEnum = z.enum(COLUMN_TYPES)
export type ColumnType = z.infer<typeof ColumnTypeEnum>

export const ColumnOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  color: z.string(),
})
export type ColumnOption = z.infer<typeof ColumnOptionSchema>

export const BoardColumnSchema = z.object({
  id: z.string(),
  // Built-in columns use a fixed document-field key ('company' | 'role' |
  // 'status' | 'resumeId' | 'createdAt'); custom columns use their generated id.
  key: z.string(),
  label: z.string().trim().min(1).max(100),
  type: ColumnTypeEnum,
  isBuiltIn: z.boolean(),
  order: z.number(),
  width: z.number().optional(),
  // Only for 'select'/'status' columns — user-defined values.
  options: z.array(ColumnOptionSchema).optional(),
})
export type BoardColumn = z.infer<typeof BoardColumnSchema>

export const SortEntrySchema = z.object({
  columnId: z.string(),
  direction: z.enum(['asc', 'desc']),
})
export type SortEntry = z.infer<typeof SortEntrySchema>

export const PatchBoardConfigSchema = z.object({
  columns: z.array(BoardColumnSchema).optional(),
  sort: z.array(SortEntrySchema).optional(),
})
export type PatchBoardConfigInput = z.infer<typeof PatchBoardConfigSchema>

// ---------------------------------------------------------------------------
// Default board config
// ---------------------------------------------------------------------------

export const DEFAULT_STATUS_OPTIONS: ColumnOption[] = [
  { id: 'applied', label: 'Applied', color: '#3b82f6' },
  { id: 'interviewing', label: 'Interviewing', color: '#f59e0b' },
  { id: 'offer', label: 'Offer', color: '#22c55e' },
  { id: 'rejected', label: 'Rejected', color: '#ef4444' },
]

/** Built-in columns can be reordered/hidden but never deleted. */
export const BUILT_IN_COLUMN_IDS = ['company', 'role', 'status', 'resumeId', 'createdAt'] as const

export function defaultBoardColumns(): BoardColumn[] {
  return [
    { id: 'company', key: 'company', label: 'Company', type: 'text', isBuiltIn: true, order: 1000 },
    { id: 'role', key: 'role', label: 'Role', type: 'text', isBuiltIn: true, order: 2000 },
    {
      id: 'status',
      key: 'status',
      label: 'Status',
      type: 'status',
      isBuiltIn: true,
      order: 3000,
      options: DEFAULT_STATUS_OPTIONS.map((o) => ({ ...o })),
    },
    { id: 'resumeId', key: 'resumeId', label: 'Resume', type: 'text', isBuiltIn: true, order: 4000 },
    { id: 'createdAt', key: 'createdAt', label: 'Applied', type: 'date', isBuiltIn: true, order: 5000 },
  ]
}

// ---------------------------------------------------------------------------
// Application rows
// ---------------------------------------------------------------------------

export const CustomFieldValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])
export type CustomFieldValue = z.infer<typeof CustomFieldValueSchema>

// Rejects keys that could pollute Object.prototype once looped into a
// Mongoose dot-notation $set path (lib/api/applications.ts) — defense in
// depth alongside the mongoose version bump past GHSA-664h-wqgq-64gw /
// CVE-2026-73562. A JSON-parsed "__proto__" key is a normal own property,
// not the object's actual prototype, so Object.keys() sees it here.
const DANGEROUS_CUSTOM_FIELD_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

export const CustomFieldsSchema = z
  .record(z.string(), CustomFieldValueSchema)
  .refine((fields) => Object.keys(fields).every((key) => !DANGEROUS_CUSTOM_FIELD_KEYS.has(key)), {
    message: 'Invalid custom field key',
  })

export const CreateApplicationSchema = z.object({
  resumeId: z.string().optional(),
  // Empty strings allowed so a blank quick-add row can be created and filled inline.
  company: z.string().trim().max(200).optional().default(''),
  role: z.string().trim().max(200).optional().default(''),
  // References an option id in the user's status column config — not an enum.
  status: z.string().optional(),
  customFields: CustomFieldsSchema.optional().default({}),
})
export type CreateApplicationInput = z.infer<typeof CreateApplicationSchema>

export const PatchApplicationSchema = z.object({
  resumeId: z.string().nullable().optional(),
  company: z.string().trim().max(200).optional(),
  role: z.string().trim().max(200).optional(),
  status: z.string().optional(),
  order: z.number().optional(),
  // Merged per-key into the existing customFields map.
  customFields: CustomFieldsSchema.optional(),
})
export type PatchApplicationInput = z.infer<typeof PatchApplicationSchema>
