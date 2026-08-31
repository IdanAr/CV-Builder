// lib/api/__tests__/resumes.integration.test.ts
// Exercises patchResume() against a real MongoDB instead of a mock, because
// the bug this guards against (silent strict-mode field stripping) only
// happens in Mongoose's real update-cast path — see the linked plan.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import mongoose from 'mongoose'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'
import type { CreateResumeInput, PatchResumeInput } from '@/lib/schemas/resume.zod'

let createResume: typeof import('../resumes')['createResume']
let patchResume: typeof import('../resumes')['patchResume']
let getResume: typeof import('../resumes')['getResume']
let listResumes: typeof import('../resumes')['listResumes']

beforeAll(async () => {
  await connectMemoryMongo()
  ;({ createResume, patchResume, getResume, listResumes } = await import('../resumes'))
}, 30000)

afterAll(async () => {
  await disconnectMemoryMongo()
})

beforeEach(async () => {
  await clearMemoryMongo()
})

const baseInput: CreateResumeInput = {
  title: 'My Resume',
  data: {},
  meta: {
    templateId: 'classic',
    fontFamily: 'Calibri',
    headerFontFamily: 'Calibri',
    primaryColor: '#000000',
    accentColor: '#0066cc',
    pageMargins: 1.0,
    lineSpacing: 1.15,
    sidebarRailWidth: 33,
    sectionOrder: ['work', 'education', 'skills'],
    layout: 'two-column',
    columnAssignment: {},
    excludedAtsKeywords: [],
  },
  applicationStatus: 'draft',
}

describe('patchResume — meta.columnAssignment persistence', () => {
  it('persists a columnAssignment patch and still updates a sibling meta field in the same request', async () => {
    const created = await createResume('u1', baseInput)
    const id = String(created._id)

    const patch: PatchResumeInput = {
      meta: {
        columnAssignment: { work: 'left', education: 'right' },
        templateId: 'modern',
      },
    }
    await patchResume('u1', id, patch)

    const reloaded = await getResume('u1', id)
    expect(reloaded?.meta.templateId).toBe('modern')
    expect(reloaded?.meta.columnAssignment).toEqual({ work: 'left', education: 'right' })
  })
})

describe('listResumes — format score caching', () => {
  it('reuses a formatScore cached at/after the resume was last updated', async () => {
    const created = await createResume('u1', baseInput)

    // Seed the cache directly via the raw driver — bypassing Mongoose's own
    // timestamps middleware entirely, since relying on a per-query override
    // of schema-level timestamps proved unreliable here. This gives the test
    // exact control over both fields the staleness comparison reads.
    const collection = mongoose.connection.collection('resumes')
    const freshTimestamp = new Date(created.updatedAt.getTime() + 1000)
    await collection.updateOne(
      { _id: created._id },
      { $set: { cachedFormatScore: 999, formatScoreComputedAt: freshTimestamp } }
    )

    const result = await listResumes('u1')
    expect(result[0].formatScore).toBe(999)
  })

  it('recomputes after the resume is edited, since editing bumps updatedAt past the cached formatScoreComputedAt', async () => {
    const created = await createResume('u1', baseInput)
    const id = String(created._id)
    const originalScore = (await listResumes('u1'))[0].formatScore

    const collection = mongoose.connection.collection('resumes')
    // "Fresh" at the moment it's set — computed exactly when last updated.
    await collection.updateOne(
      { _id: created._id },
      { $set: { cachedFormatScore: 999, formatScoreComputedAt: created.updatedAt } }
    )
    // Sanity check: the seeded cache is reused before any further edit.
    expect((await listResumes('u1'))[0].formatScore).toBe(999)

    await patchResume('u1', id, { data: { basics: { name: 'Jane Doe' } } })

    const afterEdit = await listResumes('u1')
    // The edit's own updatedAt bump makes the seeded 999 cache stale, so
    // this must recompute — landing back on the real score, not 999.
    expect(afterEdit[0].formatScore).not.toBe(999)
    expect(afterEdit[0].formatScore).toBe(originalScore)
  })
})
