import { describe, expect, it } from 'vitest'
import { MAX_JD_LENGTH } from '@/lib/ai/jd-extraction-pipeline'
import { cleanCompanyName, preparePosting } from '../posting'

describe('cleanCompanyName', () => {
  it('strips scraper suffixes', () => {
    expect(cleanCompanyName('Acme/71.00A')).toBe('Acme')
    expect(cleanCompanyName('  Acme Ltd  ')).toBe('Acme Ltd')
  })

  it('keeps names that only look like they have a suffix', () => {
    expect(cleanCompanyName('monday.com')).toBe('monday.com')
    expect(cleanCompanyName('Placer.ai')).toBe('Placer.ai')
  })
})

describe('preparePosting', () => {
  it('takes the casing the posting uses for a lower-case scraped name', () => {
    expect(preparePosting({ company: 'forter', jobText: 'At Forter we stop fraud. Forter is growing.' }).company).toBe('Forter')
    expect(preparePosting({ company: 'controlup', jobText: 'ControlUp builds DEX tools.' }).company).toBe('ControlUp')
    expect(preparePosting({ company: 'monday.com', jobText: 'Join monday.com today.' }).company).toBe('monday.com')
  })

  it('marks intermediary postings so the letter does not name the intermediary as the employer', () => {
    const viaPartner = 'This position is listed on behalf of a partner company, who manages all applications. Our partner is looking for a Senior Analyst.'
    expect(preparePosting({ company: 'jobgether', jobText: viaPartner }).employerNamed).toBe(false)
    expect(preparePosting({ company: 'Acme', jobText: 'Acme is hiring for one of its clients.' }).employerNamed).toBe(false)
    expect(preparePosting({ company: 'Acme', jobText: 'Acme builds data tools for retail partners.' }).employerNamed).toBe(true)
  })

  it('converts HTML and caps the length', () => {
    const p = preparePosting({ company: 'Acme', jobText: `<p>About&nbsp;us</p><ul><li>SQL</li></ul>${'x'.repeat(MAX_JD_LENGTH)}` })
    expect(p.text.startsWith('About us\n- SQL')).toBe(true)
    expect(p.text.length).toBe(MAX_JD_LENGTH)
  })
})
