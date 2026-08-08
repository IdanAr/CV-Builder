import { describe, it, expect } from 'vitest'
import { SAMPLE_RESUME_DATA, sampleResumeMeta } from './sample-resume'

describe('SAMPLE_RESUME_DATA', () => {
  it('has a basics block with a name and summary', () => {
    expect(SAMPLE_RESUME_DATA.basics?.name).toBeTruthy()
    expect(SAMPLE_RESUME_DATA.basics?.summary).toBeTruthy()
  })

  it('has at least one work entry with highlights', () => {
    expect(SAMPLE_RESUME_DATA.work?.length).toBeGreaterThan(0)
    expect(SAMPLE_RESUME_DATA.work?.[0]?.highlights?.length).toBeGreaterThan(0)
  })

  it('has skills and education', () => {
    expect(SAMPLE_RESUME_DATA.skills?.length).toBeGreaterThan(0)
    expect(SAMPLE_RESUME_DATA.education?.length).toBeGreaterThan(0)
  })
})

describe('sampleResumeMeta', () => {
  it('sets the requested templateId and leaves other fields at sane defaults', () => {
    const meta = sampleResumeMeta('modern')
    expect(meta.templateId).toBe('modern')
    expect(meta.layout).toBe('single-column')
    expect(meta.primaryColor).toMatch(/^#/)
  })
})
