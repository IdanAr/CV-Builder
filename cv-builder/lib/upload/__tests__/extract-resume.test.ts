import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreate = vi.fn()

vi.mock('@/lib/ai/models', () => ({
  getAnthropic: () => ({ messages: { create: mockCreate } }),
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

  it('throws ExtractionError when Claude returns a non-text content block', async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: 'tool_use', id: 'x' }] })
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
})
