import { Schema, model, models, type Document } from 'mongoose'
import type { RuleCondition, RuleAction } from '@/lib/schemas/jobsearch.zod'

export interface IJobSearchRule extends Document {
  userId: string
  profileId: string | null
  name: string
  isActive: boolean
  order: number
  conditions: RuleCondition[]
  action: RuleAction
  createdAt: Date
  updatedAt: Date
}

const JobSearchRuleSchema = new Schema<IJobSearchRule>(
  {
    userId: { type: String, required: true, index: true },
    profileId: { type: String, default: null, index: true },
    name: { type: String, required: true, maxlength: 100 },
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    // Conditions are a discriminated union at the Zod layer (the source of
    // truth per CLAUDE.md's "extend the schema first" convention) — stored
    // as Mixed here rather than re-modeled as a Mongoose discriminator,
    // mirroring how Application.customFields already stores polymorphic
    // per-column data in this codebase.
    conditions: { type: Schema.Types.Mixed, default: [] },
    action: { type: String, required: true },
  },
  { timestamps: true, minimize: false }
)

const JobSearchRule = models.JobSearchRule ?? model<IJobSearchRule>('JobSearchRule', JobSearchRuleSchema)
export default JobSearchRule
