import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@/lib/ai/models', () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
  DEFAULT_MODEL: 'claude-haiku-4-5-20251001',
}))

const { extractResume, ExtractionError } = await import('../extract-resume')

function mockResponse(text: string) {
  mockCreate.mockResolvedValueOnce({
    content: [{ type: 'text', text }],
  })
}

describe('extractResume', () => {
  beforeEach(() => mockCreate.mockClear())

  it('returns ResumeData when Claude returns valid JSON', async () => {
    mockResponse(JSON.stringify({
      basics: { name: 'Jane Smith', email: 'jane@example.com' },
      work: [{ name: 'Acme Corp', position: 'Engineer', startDate: '2020-01' }],
    }))
    const result = await extractResume('CV text here with enough content')
    expect(result.basics?.name).toBe('Jane Smith')
    expect(result.work?.[0]?.name).toBe('Acme Corp')
  })

  it('throws ExtractionError when Claude returns invalid JSON', async () => {
    mockResponse('not valid json {{{')
    await expect(extractResume('CV text')).rejects.toThrow(ExtractionError)
  })

  it('handles partial extraction (only basics present)', async () => {
    mockResponse(JSON.stringify({ basics: { name: 'John Doe' } }))
    const result = await extractResume('CV text')
    expect(result.basics?.name).toBe('John Doe')
    expect(result.work).toBeUndefined()
    expect(result.skills).toBeUndefined()
  })

  it('returns empty object when Claude returns empty JSON object', async () => {
    mockResponse('{}')
    const result = await extractResume('CV text')
    expect(result).toEqual({})
  })

  it('truncates text longer than 50 000 characters before sending to Claude', async () => {
    mockResponse('{}')
    const longText = 'a'.repeat(60_000)
    await extractResume(longText)
    const sentContent: string = mockCreate.mock.calls[0][0].messages[0].content
    expect(sentContent.length).toBeLessThanOrEqual(50_020)
  })

  it('pins temperature to 0 so identical CV text parses identically on repeat uploads', async () => {
    mockResponse('{}')
    await extractResume('CV text')
    expect(mockCreate.mock.calls[0][0].temperature).toBe(0)
  })

  it('throws ExtractionError when Claude returns a non-text content block', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'x' }] })
    await expect(extractResume('CV text')).rejects.toThrow(ExtractionError)
  })

  it('throws ExtractionError when Claude returns JSON that fails schema validation instead of persisting it', async () => {
    mockResponse(JSON.stringify({
      basics: { name: 'Jane Smith' },
      // startDate must be a string per WorkSchema — a number fails validation.
      work: [{ name: 'Acme Corp', position: 'Engineer', startDate: 2020 }],
    }))
    await expect(extractResume('CV text')).rejects.toThrow(ExtractionError)
  })

  it('normalizes AI-returned customSections: assigns ids and derives enabledFields', async () => {
    mockResponse(JSON.stringify({
      customSections: [{
        name: 'Military Service',
        items: [{
          title: 'IDF — Intelligence Corps',
          subtitle: 'Team Commander',
          startDate: '2015-03',
          endDate: '2018-03',
          summary: 'Led a team of 8 analysts.',
          highlights: ['Commander excellence award'],
        }],
      }],
    }))
    const result = await extractResume('CV text with military service section')
    const section = result.customSections?.[0]
    expect(section?.name).toBe('Military Service')
    expect(section?.id).toBeTruthy()
    expect(section?.items[0]?.id).toBeTruthy()
    expect(section?.items[0]?.title).toBe('IDF — Intelligence Corps')
    expect(section?.enabledFields).toEqual(
      expect.arrayContaining(['subtitle', 'dateRange', 'summary', 'highlights'])
    )
  })

  it('converts projects into a custom section since the editor has no projects form', async () => {
    mockResponse(JSON.stringify({
      basics: { name: 'Jane Smith' },
      projects: [{
        name: 'CV Builder',
        description: 'AI-driven resume platform',
        keywords: ['Next.js', 'TypeScript'],
        startDate: '2024-01',
      }],
    }))
    const result = await extractResume('CV text with projects')
    expect(result.projects).toBeUndefined()
    const section = result.customSections?.find((cs) => cs.name === 'Projects')
    expect(section).toBeTruthy()
    expect(section?.items[0]?.title).toBe('CV Builder')
    expect(section?.items[0]?.summary).toBe('AI-driven resume platform')
    expect(section?.items[0]?.keywords).toEqual(['Next.js', 'TypeScript'])
    expect(section?.enabledFields).toEqual(expect.arrayContaining(['summary', 'keywords', 'dateRange']))
  })

  it('converts certificates and awards into custom sections', async () => {
    mockResponse(JSON.stringify({
      certificates: [{ name: 'AWS Solutions Architect', issuer: 'Amazon', date: '2023-05' }],
      awards: [{ title: 'Employee of the Year', awarder: 'Acme', date: '2022', summary: 'Top performer.' }],
    }))
    const result = await extractResume('CV text')
    expect(result.certificates).toBeUndefined()
    expect(result.awards).toBeUndefined()
    const certs = result.customSections?.find((cs) => cs.name === 'Certificates')
    expect(certs?.items[0]).toMatchObject({ title: 'AWS Solutions Architect', subtitle: 'Amazon', startDate: '2023-05' })
    const awards = result.customSections?.find((cs) => cs.name === 'Awards')
    expect(awards?.items[0]).toMatchObject({ title: 'Employee of the Year', subtitle: 'Acme', summary: 'Top performer.' })
  })

  it('appends converted sections after AI-returned customSections', async () => {
    mockResponse(JSON.stringify({
      projects: [{ name: 'Side Project' }],
      customSections: [{ name: 'Military Service', items: [{ title: 'IDF' }] }],
    }))
    const result = await extractResume('CV text')
    expect(result.customSections?.map((cs) => cs.name)).toEqual(['Military Service', 'Projects'])
  })

  it('preserves a labeled profile URL from the AI response', async () => {
    mockResponse(JSON.stringify({
      basics: { name: 'Jane Smith', profiles: [{ label: 'Portfolio', url: 'https://janesmith.dev' }] },
    }))
    const result = await extractResume('Jane Smith\nPortfolio: https://janesmith.dev')
    expect(result.basics?.profiles?.[0]).toMatchObject({ label: 'Portfolio', url: 'https://janesmith.dev' })
  })

  it('assigns ids to work-entry roles returned by the AI and preserves them through validation', async () => {
    mockResponse(JSON.stringify({
      work: [{
        name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01',
        roles: [{ position: 'Data Team Lead', startDate: '2021-01', summary: 'Led the team.' }],
      }],
    }))
    const result = await extractResume('Meta\nData Analyst 2019-2021\nData Team Lead 2021-Present\nLed the team.')
    expect(result.work?.[0].roles?.[0]).toMatchObject({ position: 'Data Team Lead', summary: 'Led the team.' })
    expect(result.work?.[0].roles?.[0].id).toBeTruthy()
  })

  it('assigns ids to education-entry roles', async () => {
    mockResponse(JSON.stringify({
      education: [{ institution: 'MIT', studyType: 'BSc', roles: [{ studyType: 'MSc', startDate: '2020-09' }] }],
    }))
    const result = await extractResume('MIT BSc\nMIT MSc 2020-09')
    expect(result.education?.[0].roles?.[0].id).toBeTruthy()
  })

  it('assigns ids to custom-section-item roles (e.g. Military Service with rank progression)', async () => {
    mockResponse(JSON.stringify({
      customSections: [{
        name: 'Military Service',
        items: [{ title: 'IDF - Intelligence Corps', roles: [{ title: 'Team Commander', startDate: '2018-03' }] }],
      }],
    }))
    const result = await extractResume('IDF - Intelligence Corps\nTeam Commander, 2018-03')
    const section = result.customSections?.find(s => s.name === 'Military Service')
    expect(section?.items[0].roles?.[0].id).toBeTruthy()
  })

  it('normalizes an ongoing-synonym endDate to the "Present" sentinel on a work role', async () => {
    mockResponse(JSON.stringify({
      work: [{ name: 'Acme', roles: [{ position: 'Engineer', startDate: '2022-01', endDate: 'Current' }] }],
    }))
    const result = await extractResume('Acme\nEngineer 2022-Current')
    expect(result.work?.[0].roles?.[0].endDate).toBe('Present')
  })

  it.each(['present', 'CURRENT', 'Currently', 'now', 'Ongoing', 'till date'])(
    'normalizes endDate synonym %s to "Present" on an education role',
    async (synonym) => {
      mockResponse(JSON.stringify({
        education: [{ institution: 'MIT', roles: [{ studyType: 'PhD', startDate: '2022-09', endDate: synonym }] }],
      }))
      const result = await extractResume('MIT PhD 2022-')
      expect(result.education?.[0].roles?.[0].endDate).toBe('Present')
    }
  )

  it('leaves an unrecognized endDate value untouched', async () => {
    mockResponse(JSON.stringify({
      work: [{ name: 'Acme', roles: [{ position: 'Engineer', startDate: '2020-01', endDate: '2022-06' }] }],
    }))
    const result = await extractResume('Acme\nEngineer 2020-01 to 2022-06')
    expect(result.work?.[0].roles?.[0].endDate).toBe('2022-06')
  })

  it('omits endDate entirely when the AI provides no end-date information at all', async () => {
    mockResponse(JSON.stringify({
      work: [{ name: 'Acme', roles: [{ position: 'Engineer', startDate: '2020-01' }] }],
    }))
    const result = await extractResume('Acme\nEngineer since 2020')
    expect(result.work?.[0].roles?.[0].endDate).toBeUndefined()
  })

  it('fills a missing endDate from the source text when the AI dropped it but a sibling entry ending "Present" is right there (regression: real CV where a job and an in-progress degree both end "Present," AI wrote it only for the job)', async () => {
    mockResponse(JSON.stringify({
      work: [{ name: 'SAS ISRAEL', roles: [{ position: 'Architect', startDate: '2022-07', endDate: 'Present' }] }],
      education: [{ institution: 'Technion - Israel Institute of Technology', roles: [{ studyType: 'Generative AI & LLMs', startDate: '2025-12' }] }],
    }))
    const result = await extractResume(
      'SAS ISRAEL\t07/2022 - Present\nArchitect\n\nTechnion - Israel Institute of Technology\t12/2025 – Present\nGenerative AI & LLMs'
    )
    expect(result.work?.[0].roles?.[0].endDate).toBe('Present')
    expect(result.education?.[0].roles?.[0].endDate).toBe('Present')
  })

  it('does not invent an endDate for an entry with no date range in the source text, even if it sits near unrelated "Present" anchors', async () => {
    mockResponse(JSON.stringify({
      work: [{ name: 'SAS ISRAEL', roles: [{ position: 'Architect', startDate: '2022-07', endDate: 'Present' }] }],
      customSections: [{
        name: 'Projects',
        items: [{ title: 'CV-Builder', summary: 'A resume builder.' }],
      }],
    }))
    const result = await extractResume(
      'SAS ISRAEL\t07/2022 - Present\nArchitect\n\nProjects\nCV-Builder (Active Development)\nA resume builder.'
    )
    const projects = result.customSections?.find((cs) => cs.name === 'Projects')
    expect(projects?.items[0].startDate).toBeUndefined()
    expect(projects?.items[0].endDate).toBeUndefined()
  })

  it('drops an endDate the AI returned with no matching startDate (orphan endDate)', async () => {
    mockResponse(JSON.stringify({
      customSections: [{
        name: 'Projects',
        items: [{ title: 'CV-Builder', endDate: 'Present', summary: 'A resume builder.' }],
      }],
    }))
    const result = await extractResume('Projects\nCV-Builder (Active Development)\nA resume builder.')
    const projects = result.customSections?.find((cs) => cs.name === 'Projects')
    expect(projects?.items[0].endDate).toBeUndefined()
  })
})
