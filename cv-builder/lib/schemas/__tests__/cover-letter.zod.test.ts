import { describe, it, expect } from 'vitest'
import { MAX_JD_LENGTH } from '@/lib/ai/jd-extraction-pipeline'
import {
  CoverLetterNotesSchema,
  CoverLetterStatusEnum,
  CreateCoverLetterSchema,
  UpdateCoverLetterSchema,
} from '../cover-letter.zod'

const valid = { company: 'Acme Ltd', role: 'Data Analyst', jobText: 'We are hiring an analyst.' }

describe('CreateCoverLetterSchema', () => {
  it('accepts a minimal valid input', () => {
    expect(CreateCoverLetterSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects an empty jobText', () => {
    expect(CreateCoverLetterSchema.safeParse({ ...valid, jobText: '' }).success).toBe(false)
  })

  it('rejects a jobText over the extraction limit', () => {
    const r = CreateCoverLetterSchema.safeParse({ ...valid, jobText: 'x'.repeat(MAX_JD_LENGTH + 1) })
    expect(r.success).toBe(false)
  })

  it('rejects a 201-character company and accepts 200', () => {
    expect(CreateCoverLetterSchema.safeParse({ ...valid, company: 'c'.repeat(201) }).success).toBe(false)
    expect(CreateCoverLetterSchema.safeParse({ ...valid, company: 'c'.repeat(200) }).success).toBe(true)
  })

  it('rejects an empty role', () => {
    expect(CreateCoverLetterSchema.safeParse({ ...valid, role: '' }).success).toBe(false)
  })

  it('rejects notes over the caps', () => {
    for (const notes of [
      { motivation: 'm'.repeat(1001) },
      { explain: 'e'.repeat(1001) },
      { hiringManager: 'h'.repeat(121) },
    ]) {
      expect(CreateCoverLetterSchema.safeParse({ ...valid, notes }).success).toBe(false)
    }
  })

  it('accepts notes at the caps and optional links', () => {
    const r = CreateCoverLetterSchema.safeParse({
      ...valid,
      notes: { motivation: 'm'.repeat(1000), explain: 'e'.repeat(1000), hiringManager: 'h'.repeat(120) },
      applicationId: 'app-1',
      scrapedJobId: 'job-1',
    })
    expect(r.success).toBe(true)
  })
})

describe('CoverLetterNotesSchema', () => {
  it('trims every field', () => {
    const r = CoverLetterNotesSchema.parse({ motivation: '  why  ', hiringManager: ' Dana ' })
    expect(r).toEqual({ motivation: 'why', hiringManager: 'Dana' })
  })
})

describe('UpdateCoverLetterSchema', () => {
  it('rejects a non-empty pendingApprovals list', () => {
    expect(UpdateCoverLetterSchema.safeParse({ pendingApprovals: ['x'] }).success).toBe(false)
  })

  it('accepts an empty pendingApprovals list', () => {
    expect(UpdateCoverLetterSchema.safeParse({ pendingApprovals: [] }).success).toBe(true)
  })

  it('rejects content over 20000 characters', () => {
    expect(UpdateCoverLetterSchema.safeParse({ content: 'x'.repeat(20001) }).success).toBe(false)
    expect(UpdateCoverLetterSchema.safeParse({ content: 'x'.repeat(20000) }).success).toBe(true)
  })
})

describe('CoverLetterStatusEnum', () => {
  it('allows only writing, ready and failed', () => {
    expect(CoverLetterStatusEnum.options).toEqual(['writing', 'ready', 'failed'])
  })
})
