// Data access for job-search rules. Every query is scoped to the
// requesting userId — never trust an id alone (CLAUDE.md route-protection convention).
import dbConnect from '@/lib/db'
import JobSearchRule from '@/models/JobSearchRule'
import JobSearchProfile from '@/models/JobSearchProfile'
import type { CreateJobSearchRuleInput, PatchJobSearchRuleInput } from '@/lib/schemas/jobsearch.zod'

// Rules that apply to this profile: its own profile-scoped rules plus every
// global rule (profileId: null) — mirrors the resolution semantics in the
// design spec §4, which evaluates a posting against both.
export async function listRulesForProfile(userId: string, profileId: string) {
  await dbConnect()
  return JobSearchRule.find({ userId, $or: [{ profileId }, { profileId: null }] })
    .sort({ order: 1, createdAt: 1 })
    .lean()
}

export async function createJobSearchRule(userId: string, input: CreateJobSearchRuleInput) {
  await dbConnect()

  // Unlike JobSearchProfile.resumeId (a soft link that silently falls back
  // when unowned), a rule's profileId controls WHICH postings it evaluates.
  // Silently dropping an unowned profileId to null would turn a rejected
  // profile-scoped rule into an unexpectedly global one — reject the whole
  // creation instead.
  if (input.profileId) {
    const profile = await JobSearchProfile.findOne({ _id: input.profileId, userId }).lean()
    if (!profile) return null
  }

  return JobSearchRule.create({ ...input, userId })
}

export async function getJobSearchRule(userId: string, id: string) {
  await dbConnect()
  return JobSearchRule.findOne({ _id: id, userId }).lean()
}

export async function updateJobSearchRule(
  userId: string,
  id: string,
  input: PatchJobSearchRuleInput
) {
  await dbConnect()

  const setPayload: PatchJobSearchRuleInput = { ...input }
  if (input.profileId !== undefined && input.profileId !== null) {
    // Same ownership check as create, but on update the safe fallback is to
    // leave the rule's existing profileId untouched (mirrors
    // updateJobSearchProfile's resumeId handling) rather than reject the
    // whole patch over one bad field.
    const profile = await JobSearchProfile.findOne({ _id: input.profileId, userId }).lean()
    if (!profile) {
      delete setPayload.profileId
    }
  }

  return JobSearchRule.findOneAndUpdate({ _id: id, userId }, { $set: setPayload }, { new: true }).lean()
}

export async function deleteJobSearchRule(userId: string, id: string): Promise<boolean> {
  await dbConnect()
  const result = await JobSearchRule.deleteOne({ _id: id, userId })
  return result.deletedCount === 1
}
