import { describe, it, expect } from 'vitest'
import { ResumeMetaSchema, PatchResumeSchema } from '../resume.zod'

describe('ResumeMetaSchema', () => {
  it('defaults columnAssignment to empty object', () => {
    const result = ResumeMetaSchema.parse({})
    expect(result.columnAssignment).toEqual({})
  })

  it('accepts valid columnAssignment entries', () => {
    const result = ResumeMetaSchema.parse({
      columnAssignment: { work: 'right', skills: 'left' },
    })
    expect(result.columnAssignment).toEqual({ work: 'right', skills: 'left' })
  })
})

describe('PatchResumeSchema meta.columnAssignment', () => {
  it('accepts a partial columnAssignment in a meta patch', () => {
    const result = PatchResumeSchema.parse({
      meta: { columnAssignment: { skills: 'left' } },
    })
    expect(result.meta?.columnAssignment).toEqual({ skills: 'left' })
  })

  it('accepts a patch with no columnAssignment', () => {
    const result = PatchResumeSchema.parse({ meta: {} })
    expect(result.meta?.columnAssignment).toBeUndefined()
  })
})
