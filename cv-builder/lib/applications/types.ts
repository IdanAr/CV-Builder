// lib/applications/types.ts
// Client-facing shapes for the applications supertable (serialized documents).
import type { BoardColumn, CustomFieldValue, SortEntry } from '@/lib/schemas/application.zod'

export interface ApplicationRow {
  _id: string
  resumeId?: string | null
  company: string
  role: string
  status: string
  order: number
  customFields: Record<string, CustomFieldValue>
  /** Resolved server-side via the batched Map lookup; undefined when unlinked. */
  resumeTitle?: string
  createdAt: string
  updatedAt: string
}

export interface BoardConfigData {
  columns: BoardColumn[]
  sort: SortEntry[]
}

export interface ResumeOption {
  id: string
  title: string
}

export interface ActivityEntry {
  _id: string
  field: string
  fieldLabel: string
  fromValue: string | null
  toValue: string | null
  changedAt: string
}
