// lib/api/__tests__/resumes.integration.test.ts
// Exercises patchResume() against a real MongoDB instead of a mock, because
// the bug this guards against (silent strict-mode field stripping) only
// happens in Mongoose's real update-cast path — see the linked plan.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
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
  it('persists a computed formatScore so a second read reuses it without recomputing', async () => {
    const created = await createResume('u1', baseInput)
    const id = String(created._id)

    const first = await listResumes('u1')
    expect(first[0].formatScore).toBeDefined()

    // Directly corrupt the DB's cached value (bypassing scoreResume entirely)
    // to prove the second read comes from the cache, not a fresh computation.
    const Resume = (await import('@/models/Resume')).default
    // { timestamps: false } — schema-level timestamps also apply to plain
    // updateOne() calls, so without this the update below would itself bump
    // updatedAt and immediately re-invalidate the cache it's setting.
    await Resume.updateOne({ _id: id }, { $set: { cachedFormatScore: 999 } }, { timestamps: false })

    const second = await listResumes('u1')
    expect(second[0].formatScore).toBe(999)
  })

  it('recomputes after the resume is edited, since editing bumps updatedAt past the cached formatScoreComputedAt', async () => {
    const created = await createResume('u1', baseInput)
    const id = String(created._id)

    const first = await listResumes('u1')
    const originalScore = first[0].formatScore

    const Resume = (await import('@/models/Resume')).default
    // { timestamps: false } — schema-level timestamps also apply to plain
    // updateOne() calls, so without this the update below would itself bump
    // updatedAt and immediately re-invalidate the cache it's setting.
    await Resume.updateOne({ _id: id }, { $set: { cachedFormatScore: 999 } }, { timestamps: false })
    await patchResume('u1', id, { data: { basics: { name: 'Jane Doe' } } })

    const second = await listResumes('u1')
    // The edit's own updatedAt bump makes the corrupted 999 cache stale, so
    // this must recompute — landing back on the real score, not 999.
    expect(second[0].formatScore).not.toBe(999)
    expect(second[0].formatScore).toBe(originalScore)
  })
})
