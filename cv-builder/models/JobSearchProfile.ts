import { Schema, model, models, type Document } from 'mongoose'
import type { JobLocation, WorkMode } from '@/lib/schemas/jobsearch.zod'

export interface IJobSearchProfile extends Document {
  userId: string
  name: string
  resumeId?: string
  roles: string[]
  workModes: WorkMode[]
  locations: JobLocation[]
  seniority: string[]
  categories: string[]
  industries: string[]
  recencyDays: number
  minAtsScore: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const JobLocationSubSchema = new Schema<JobLocation>(
  { country: String, region: String, city: String },
  { _id: false }
)

const JobSearchProfileSchema = new Schema<IJobSearchProfile>(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, maxlength: 100 },
    resumeId: { type: String },
    roles: { type: [String], default: [] },
    workModes: { type: [String], default: [] },
    locations: { type: [JobLocationSubSchema], default: [] },
    seniority: { type: [String], default: [] },
    categories: { type: [String], default: [] },
    industries: { type: [String], default: [] },
    recencyDays: { type: Number, default: 14 },
    minAtsScore: { type: Number, default: 75 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, minimize: false }
)

const JobSearchProfile =
  models.JobSearchProfile ?? model<IJobSearchProfile>('JobSearchProfile', JobSearchProfileSchema)
export default JobSearchProfile
