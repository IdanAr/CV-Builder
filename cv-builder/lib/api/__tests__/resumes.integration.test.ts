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

beforeAll(async () => {
  await connectMemoryMongo()
  ;({ createResume, patchResume, getResume } = await import('../resumes'))
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
