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
let duplicateResume: typeof import('../resumes')['duplicateResume']
let deleteScrapedJob: typeof import('../scraped-jobs')['deleteScrapedJob']

beforeAll(async () => {
  await connectMemoryMongo()
  api = await import('../cover-letters')
  CoverLetter = (await import('@/models/CoverLetter')).default
  Resume = (await import('@/models/Resume')).default
  ScrapedJob = (await import('@/models/ScrapedJob')).default
  ;({ deleteResume, duplicateResume } = await import('../resumes'))
  ;({ deleteScrapedJob } = await import('../scraped-jobs'))
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

describe('ordering', () => {
  it('keeps creation order when an older letter is edited', async () => {
    const cv = await makeResume()
    const older = await api.createCoverLetter('u1', cv, { ...input, notes: { explain: 'older' } })
    await new Promise((r) => setTimeout(r, 5))
    const newer = await api.createCoverLetter('u1', cv, { ...input, notes: { explain: 'newer' } })
    await CoverLetter.updateOne({ _id: older.id }, { $set: { status: 'ready' } })
    await api.updateCoverLetter('u1', cv, older.id, { content: 'Edited later' })
    expect((await api.listCoverLetters('u1', cv)).map((l) => l.id)).toEqual([newer.id, older.id])
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

  it('does not bring a deleted legacy letter back', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'Old text' } })
    const [legacy] = await api.listCoverLetters('u1', cv)
    expect(await api.deleteCoverLetter('u1', cv, legacy.id)).toBe(true)
    expect(await api.listCoverLetters('u1', cv)).toEqual([])
    expect((await Resume.findById(cv).lean())?.coverLetterMigrated).toBe(true)
  })

  it('does not count the migration as an edit of the CV', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'Old text' } })
    const before = (await Resume.findById(cv).lean())?.updatedAt
    await api.migrateLegacyCoverLetter('u1', cv)
    expect((await Resume.findById(cv).lean())?.updatedAt).toEqual(before)
  })

  it('gives a duplicate of a migrated CV its own legacy letter', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'Old text' } })
    await api.listCoverLetters('u1', cv)
    const copy = await duplicateResume('u1', cv)
    expect(copy?.coverLetterMigrated).toBeUndefined()
    const letters = await api.listCoverLetters('u1', String(copy?._id))
    expect(letters).toHaveLength(1)
    expect(letters[0]).toMatchObject({ legacy: true, content: 'Old text' })
  })

  it('cuts a legacy text longer than a letter can hold instead of failing', async () => {
    const cv = await makeResume('u1', { data: { coverLetter: 'x'.repeat(25_000) } })
    const list = await api.listCoverLetters('u1', cv)
    expect(list).toHaveLength(1)
    expect(list[0].content).toHaveLength(20_000)
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

  it('returns null when the letter is deleted between the read and the stale mark', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { startedAt: ago(91_000) } })
    const realFind = CoverLetter.findOne.bind(CoverLetter)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(CoverLetter as any).findOne = (...args: unknown[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (realFind as any)(...args)
      const origLean = q.lean.bind(q)
      q.lean = async () => {
        const doc = await origLean()
        await CoverLetter.deleteOne({ _id: created.id })
        return doc
      }
      return q
    }
    try {
      expect(await api.getCoverLetter('u1', cv, created.id)).toBeNull()
    } finally {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(CoverLetter as any).findOne = realFind
    }
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

  it('persists the chosen design and returns it in the view', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    expect(created.design).toBeUndefined()
    await CoverLetter.updateOne({ _id: created.id }, { $set: { status: 'ready' } })
    const updated = await api.updateCoverLetter('u1', cv, created.id, { design: 'accent-edge' })
    expect(updated).toMatchObject({ design: 'accent-edge' })
    expect((await CoverLetter.findById(created.id).lean())?.design).toBe('accent-edge')
    expect(await api.getCoverLetter('u1', cv, created.id)).toMatchObject({ design: 'accent-edge' })
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

describe('deleteScrapedJob cascade', () => {
  it("deletes the draft CV's letters along with the draft, and keeps other CVs' letters", async () => {
    const draft = await makeResume()
    const keep = await makeResume()
    const sj = await ScrapedJob.create({
      userId: 'u1',
      profileId: 'p1',
      source: 'comeet',
      sourceId: 'invented-1',
      title: 'Platform Engineer',
      company: 'Northwind',
      url: 'https://example.test/job',
      description: 'We build tools for small shops.',
      firstSeenAt: new Date(),
      draftResumeId: draft,
    })
    await api.createCoverLetter('u1', draft, { ...input, scrapedJobId: String(sj._id) })
    await api.createCoverLetter('u1', keep, input)

    expect(await deleteScrapedJob('u1', String(sj._id))).toEqual({ deleted: true, deletedDraftResume: true })
    expect(await Resume.countDocuments({ _id: draft })).toBe(0)
    expect(await CoverLetter.countDocuments({ resumeId: draft })).toBe(0)
    expect(await CoverLetter.countDocuments({ resumeId: keep })).toBe(1)
  })
})

describe('getCoverLetter posting text', () => {
  it('returns the posting for a failed letter, so Try again can reuse it', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { status: 'failed', error: 'x' } })
    expect((await api.getCoverLetter('u1', cv, created.id))?.jobText).toBe(input.jobText)
  })

  it('returns it once the stale rule fails a letter', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { startedAt: new Date(Date.now() - 91_000) } })
    expect((await api.getCoverLetter('u1', cv, created.id))?.jobText).toBe(input.jobText)
  })

  it('returns it for a written letter, so Write a new version can reuse it', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: created.id }, { $set: { status: 'ready' } })
    expect((await api.getCoverLetter('u1', cv, created.id))?.jobText).toBe(input.jobText)
  })

  it('leaves it out for writing and legacy letters, and from every list', async () => {
    const cv = await makeResume()
    const writing = await api.createCoverLetter('u1', cv, input)
    const ready = await api.createCoverLetter('u1', cv, input)
    const failed = await api.createCoverLetter('u1', cv, input)
    const legacy = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: ready.id }, { $set: { status: 'ready' } })
    await CoverLetter.updateOne({ _id: failed.id }, { $set: { status: 'failed', error: 'x' } })
    await CoverLetter.updateOne({ _id: legacy.id }, { $set: { status: 'ready', legacy: true } })
    expect((await api.getCoverLetter('u1', cv, writing.id))?.jobText).toBeUndefined()
    expect((await api.getCoverLetter('u1', cv, legacy.id))?.jobText).toBeUndefined()
    for (const l of await api.listCoverLetters('u1', cv)) expect((l as Record<string, unknown>).jobText).toBeUndefined()
  })
})

describe('failWritingLetter', () => {
  it('fails a writing letter with the message', async () => {
    const cv = await makeResume()
    const created = await api.createCoverLetter('u1', cv, input)
    await api.failWritingLetter('u1', cv, created.id, api.START_FAILED_MESSAGE)
    const stored = await CoverLetter.findById(created.id).lean()
    expect(stored?.status).toBe('failed')
    expect(stored?.error).toBe(api.START_FAILED_MESSAGE)
  })

  it('leaves a letter that is no longer writing, or another user\'s, alone', async () => {
    const cv = await makeResume()
    const ready = await api.createCoverLetter('u1', cv, input)
    await CoverLetter.updateOne({ _id: ready.id }, { $set: { status: 'ready', content: 'Done.' } })
    await api.failWritingLetter('u1', cv, ready.id, api.START_FAILED_MESSAGE)
    expect((await CoverLetter.findById(ready.id).lean())?.status).toBe('ready')

    const theirs = await api.createCoverLetter('u1', cv, input)
    await api.failWritingLetter('u2', cv, theirs.id, api.START_FAILED_MESSAGE)
    expect((await CoverLetter.findById(theirs.id).lean())?.status).toBe('writing')
  })
})
