import { describe, expect, it } from 'vitest'
import { flattenAllText } from '@/lib/ats/scorer'
import { ResumeDataSchema } from '@/lib/schemas/resume.zod'
import { EVAL_PAIRS } from './pairs'
import { SYNTHETIC_CVS } from './synthetic-cvs'

describe('synthetic CVs', () => {
  it('all parse against the app schema', () => {
    for (const [key, cv] of Object.entries(SYNTHETIC_CVS)) {
      expect(() => ResumeDataSchema.parse(cv), key).not.toThrow()
    }
  })

  it('keeps the no-metrics CV free of figures outside dates, so any number in a letter is invented', () => {
    expect(flattenAllText(SYNTHETIC_CVS['syn-nometrics'])).not.toMatch(/\d/)
  })

  it('keeps the sparse CV to one job with two bullets and no summary, so a padded letter has nothing to stand on', () => {
    const cv = SYNTHETIC_CVS['syn-sparse']
    expect(cv.work).toHaveLength(1)
    expect(cv.work?.[0].highlights).toHaveLength(2)
    expect(cv.basics?.summary).toBeUndefined()
  })

  it('every synthetic pair points at an existing CV', () => {
    for (const pair of EVAL_PAIRS.filter((p) => p.source === 'synthetic')) {
      expect(SYNTHETIC_CVS[pair.resumeKey], pair.id).toBeDefined()
    }
  })
})
