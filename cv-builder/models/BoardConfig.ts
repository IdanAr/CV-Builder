import { Schema, model, models, type Document } from 'mongoose'
import type { BoardColumn, SortEntry } from '@/lib/schemas/application.zod'

// One document per user. Auth runs through @auth/mongodb-adapter (no app-owned
// User model), so board config is its own collection keyed by userId — the
// same convention Resume uses.
export interface IBoardConfig extends Document {
  userId: string
  columns: BoardColumn[]
  // Ordered list = multi-column sort; first entry is primary, later entries
  // break ties within the previous ones.
  sort: SortEntry[]
  createdAt: Date
  updatedAt: Date
}

const ColumnOptionSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false }
)

const BoardColumnSchema = new Schema(
  {
    id: { type: String, required: true },
    key: { type: String, required: true },
    label: { type: String, required: true, maxlength: 100 },
    type: {
      type: String,
      enum: ['text', 'number', 'date', 'url', 'select', 'status', 'checkbox'],
      required: true,
    },
    isBuiltIn: { type: Boolean, required: true },
    order: { type: Number, required: true },
    width: { type: Number },
    options: { type: [ColumnOptionSchema], default: undefined },
  },
  { _id: false }
)

const SortEntrySchema = new Schema(
  {
    columnId: { type: String, required: true },
    direction: { type: String, enum: ['asc', 'desc'], required: true },
  },
  { _id: false }
)

const BoardConfigSchema = new Schema<IBoardConfig>(
  {
    userId: { type: String, required: true, unique: true },
    columns: { type: [BoardColumnSchema], default: [] },
    sort: { type: [SortEntrySchema], default: [] },
  },
  { timestamps: true }
)

const BoardConfig = models.BoardConfig ?? model<IBoardConfig>('BoardConfig', BoardConfigSchema)
export default BoardConfig
