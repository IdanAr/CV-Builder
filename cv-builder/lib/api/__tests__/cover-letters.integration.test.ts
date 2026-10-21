// lib/api/__tests__/cover-letters.integration.test.ts
// Runs the cover-letter data layer against a real in-memory MongoDB replica set:
// the legacy migration relies on a unique partial index, the stale rule on
// conditional updates, and neither can be seen through a mocked model.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { connectMemoryMongo, disconnectMemoryMongo, clearMemoryMongo } from '@/test/mongo-memory'

let api: typeof import('../cover-letters')
let CoverLetter: typeof import('@/models/CoverLetter')['default']
let Resume: typeof import('@/models/Resume')['default']
let ScrapedJob: typeof import('@/models/ScrapedJob')['default']
let deleteResume: typeof import('../resumes')['deleteResume']

beforeAll(async () => {
  await connectMemoryMongo()
  api = await import('../cover-letters')
  CoverLetter = (await import('@/models/CoverLetter')).default
  Resume = (await import('@/models/Resume')).default
  ScrapedJob = (await import('@/models/ScrapedJob')).default
  ;({ deleteResume } = await import('../resumes'))
  await CoverLetter.init()
}, 60000)

afterAll(async () => {
  await disconnectMemoryMongo()
})

beforeEach(async () => {
  await clearMemoryMongo()
})

const input = {
  company: 'Northwind',
  role: 'Platform Engineer',
  jobText: 'We build tools for small shops.',
}

async function makeResume(userId = 'u1', extra: Record<string, unknown> = {}) {
  const r = await Resume.create({ userId, title: 'My CV', ...extra })
  return String(r._id)
}

describe('listCoverLetters', () => {
  it('lists newest first, only for the given user and CV, without leaking internals', async () => {
    const mine = await makeResume('u1')
    const other = await makeResume('u1')
    const first = await api.createCoverLetter('u1', mine, input)
    await new Promise((r) => setTimeout(r, 5))
    const second = await api.createCoverLetter('u1', mine, { ...input, company: 'Contoso' })
    await api.createCoverLetter('u1', other, input)
    await CoverLetter.create({ ...input, userId: 'u2', resumeId: mine })

    const list = await api.listCoverLetters('u1', mine)
    expect(list.map((l) => l.id)).toEqual([second.id, first.id])
    const view = list[0] as Record<string, unknown>
    expect(view.jobText).toBeUndefined()
    expect(view._id).toBeUndefined()
    expect(view.__v).toBeUndefined()
    expect(typeof view.id).toBe('string')
    expect(await api.listCoverLetters('u2', other)).toEqual([])
  })
})

describe('createCoverLetter', () => {
  it('creates a writing letter and keeps the posting out of the view', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, {
      ...input,
      notes: { explain: 'Career change' },
    })
    expect(created.status).toBe('writing')
    expect(created.notes.explain).toBe('Career change')
    expect((created as Record<string, unknown>).jobText).toBeUndefined()
    const stored = await CoverLetter.findById(created.id).lean()
    expect(stored?.jobText).toBe(input.jobText)
  })
})

describe('migrateLegacyCoverLetter', () => {
  it('turns data.coverLetter into one legacy ready letter', async () => {
    const cv = await makeResume('u1', {
      targetCompany: 'Acme',
      targetRole: 'Designer',
      data: { coverLetter: 'Old text' },
    })
    await api.migrateLegacyCoverLetter('u1', cv)
    const letters = await CoverLetter.find({ resumeId: cv }).lean()
    expect(letters).toHaveLength(1)
    expect(letters[0]).toMatchObject({
      legacy: true,
      status: 'ready',
      content: 'Old text',
      company: 'Acme',
      role: 'Designer',
    })
  })

  it('creates nothing on a second call', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'Old text' } })
    await api.migrateLegacyCoverLetter('u1', cv)
    await api.migrateLegacyCoverLetter('u1', cv)
    expect(await CoverLetter.countDocuments({ resumeId: cv })).toBe(1)
  })

  it('creates exactly one letter when two calls race', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'Old text' } })
    await CoverLetter.init()
    await Promise.all([api.migrateLegacyCoverLetter('u1', cv), api.migrateLegacyCoverLetter('u1', cv)])
    expect(await CoverLetter.countDocuments({ resumeId: cv })).toBe(1)
  })

  it('creates nothing for an empty or missing coverLetter', async () => {
    const empty = await makeResume('u1', { data: { coverLetter: '   ' } })
    const missing = await makeResume('u1')
    await api.migrateLegacyCoverLetter('u1', empty)
    await api.migrateLegacyCoverLetter('u1', missing)
    expect(await CoverLetter.countDocuments({})).toBe(0)
  })

  it('does not migrate another user\'s CV', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'Old text' } })
    await api.migrateLegacyCoverLetter('u2', cv)
    expect(await CoverLetter.countDocuments({})).toBe(0)
  })

  it('runs as part of listCoverLetters', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'Old text' } })
    const list = await api.listCoverLetters('u1', cv)
    expect(list).toHaveLength(1)
    expect(list[0].legacy).toBe(true)
  })
})

describe('stale writing letters', () => {
  const ago = (ms: number) => new Date(Date.now() - ms)

  it('getCoverLetter fails a letter whose startedAt is over 90 s old, and persists it', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { startedAt: ago(91_000) } })

    const got = await api.getCoverLetter('u1', cv, created.id)
    expect(got?.status).toBe('failed')
    expect(got?.error).toBe(api.STALE_MESSAGE)
    const stored = await CoverLetter.findById(created.id).lean()
    expect(stored?.status).toBe('failed')
    expect(stored?.error).toBe(api.STALE_MESSAGE)
  })

  it('fails a never-started letter whose createdAt is over 90 s old', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.collection.updateOne(
      { _id: new (await import('mongoose')).default.Types.ObjectId(created.id) },
      { $set: { createdAt: ago(91_000) } }
    )
    const got = await api.getCoverLetter('u1', cv, created.id)
    expect(got?.status).toBe('failed')
  })

  it('leaves a fresh writing letter alone', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { startedAt: ago(30_000) } })
    expect((await api.getCoverLetter('u1', cv, created.id))?.status).toBe('writing')
  })

  it('does not overwrite a letter that finished at the same moment', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { startedAt: ago(91_000) } })
    // The job finishes between the read and the stale mark: simulate by
    // flipping the stored status right after the read returns.
    const realFind = CoverLetter.findOne.bind(CoverLetter)
    let flipped = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(CoverLetter as any).findOne = (...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (realFind as any)(...args)
      const origLean = q.lean.bind(q)
      q.lean = async () => {
        const doc = await origLean()
        if (!flipped) {
          flipped = true
          await CoverLetter.updateOne({ _id: created.id }, { $set: { status: 'ready', content: 'Done' } })
        }
        return doc
      }
      return q
    }
    try {
      const got = await api.getCoverLetter('u1', cv, created.id)
      expect(got?.status).toBe('ready')
      expect(got?.content).toBe('Done')
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(CoverLetter as any).findOne = realFind
    }
    const stored = await CoverLetter.findById(created.id).lean()
    expect(stored?.status).toBe('ready')
  })

  it('listCoverLetters applies the rule too', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { startedAt: ago(91_000) } })
    const list = await api.listCoverLetters('u1', cv)
    expect(list[0].status).toBe('failed')
    expect((await CoverLetter.findById(created.id).lean())?.status).toBe('failed')
  })

  it('getCoverLetter returns null for another user or CV', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    expect(await api.getCoverLetter('u2', cv, created.id)).toBeNull()
    expect(await api.getCoverLetter('u1', await makeResume(), created.id)).toBeNull()
  })
})

describe('updateCoverLetter', () => {
  it('returns "writing" for a letter still being written, without changing it', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    expect(await api.updateCoverLetter('u1', cv, created.id, { content: 'Hi' })).toBe('writing')
    expect((await CoverLetter.findById(created.id).lean())?.content).toBe('')
  })

  it('edits content and clears pending approvals on a ready letter', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne(
      { _id: created.id },
      { $set: { status: 'ready', content: 'Draft', pendingApprovals: ['40%'] } }
    )
    const updated = await api.updateCoverLetter('u1', cv, created.id, {
      content: 'Edited',
      pendingApprovals: [],
      notes: { motivation: 'Love the product' },
    })
    expect(updated).not.toBe('writing')
    expect(updated).toMatchObject({
      content: 'Edited',
      pendingApprovals: [],
      notes: { motivation: 'Love the product' },
    })
  })

  it('returns null for an unknown letter or another user', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    expect(await api.updateCoverLetter('u2', cv, created.id, { content: 'x' })).toBeNull()
  })
})

describe('deleteCoverLetter', () => {
  it('deletes only the caller\'s letter', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    expect(await api.deleteCoverLetter('u2', cv, created.id)).toBe(false)
    expect(await api.deleteCoverLetter('u1', cv, created.id)).toBe(true)
    expect(await api.deleteCoverLetter('u1', cv, created.id)).toBe(false)
  })
})

describe('latestNotes', () => {
  it('returns the explain note of the newest letter', async () => {
    const cv = await makeResume()
    await api.createCoverLetter('u1', cv, { ...input, notes: { explain: 'Old gap' } })
    await new Promise((r) => setTimeout(r, 5))
    await api.createCoverLetter('u1', cv, { ...input, notes: { explain: 'New gap', motivation: 'x' } })
    expect(await api.latestNotes('u1', cv)).toEqual({ explain: 'New gap' })
  })

  it('returns an empty object when there is nothing', async () => {
    expect(await api.latestNotes('u1', await makeResume())).toEqual({})
  })
})

describe('suggestedPostingFor', () => {
  const job = (userId: string, draftResumeId?: string) => ({
    userId,
    profileId: 'p1',
    source: 'comeet',
    sourceId: `s-${Math.random()}`,
    title: 'Backend Developer',
    company: 'forter/71.00A',
    url: 'https://example.test/job',
    description: '<p>Build <b>things</b> at Forter.</p>',
    firstSeenAt: new Date(),
    draftResumeId,
  })

  it('returns the draft posting with HTML removed', async () => {
    const cv = await makeResume()
    const sj = await ScrapedJob.create(job('u1', cv))
    const s = await api.suggestedPostingFor('u1', cv)
    expect(s).not.toBeNull()
    expect(s?.scrapedJobId).toBe(String(sj._id))
    expect(s?.role).toBe('Backend Developer')
    expect(s?.company).toBe('Forter')
    expect(s?.jobText).toContain('Build things at Forter.')
    expect(s?.jobText).not.toContain('<')
  })

  it('returns null for a CV no scraped job points at', async () => {
    await ScrapedJob.create(job('u1', 'someone-else'))
    expect(await api.suggestedPostingFor('u1', await makeResume())).toBeNull()
  })

  it('returns null for another user\'s scraped job', async () => {
    const cv = await makeResume()
    await ScrapedJob.create(job('u2', cv))
    expect(await api.suggestedPostingFor('u1', cv)).toBeNull()
  })
})

describe('deleteResume cascade', () => {
  it('removes the CV\'s letters and keeps other CVs\' letters', async () => {
    const cv = await makeResume()
    const keep = await makeResume()
    await api.createCoverLetter('u1', cv, input)
    await api.createCoverLetter('u1', keep, input)
    expect(await deleteResume('u1', cv)).toBe(true)
    expect(await CoverLetter.countDocuments({ resumeId: cv })).toBe(0)
    expect(await CoverLetter.countDocuments({ resumeId: keep })).toBe(1)
  })

  it('leaves the letters when the CV is not the caller\'s', async () => {
    const cv = await makeResume('u1')
    await api.createCoverLetter('u1', cv, input)
    expect(await deleteResume('u2', cv)).toBe(false)
    expect(await CoverLetter.countDocuments({ resumeId: cv })).toBe(1)
  })
})
