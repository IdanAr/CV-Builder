import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExtractResume = vi.fn()
const mockCreateResume = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) =>
    handler(Object.assign(req, { auth: { user: { id: 'user1' } } }), ctx)
  ),
}))

vi.mock('@/lib/upload/extract-resume', () => {
  class ExtractionError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ExtractionError' }
  }
  return { extractResume: (...args: unknown[]) => mockExtractResume(...args), ExtractionError }
})

vi.mock('@/lib/api/resumes', () => ({
  createResume: (...args: unknown[]) => mockCreateResume(...args),
}))

vi.mock('@/lib/db', () => ({ default: vi.fn() }))

describe('POST /api/resumes/upload/extract', () => {
  beforeEach(() => {
    mockExtractResume.mockClear()
    mockCreateResume.mockClear()
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce(
      (handler) => async (req: Request, ctx: unknown) =>
        handler(Object.assign(req, { auth: null }) as Parameters<typeof handler>[0], ctx as Parameters<typeof handler>[1])
    )
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'some text' }),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 when text is empty', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '   ' }),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('BAD_REQUEST')
  })

  it('returns 400 (not a crash) when the JSON body is the literal value null', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(null),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('BAD_REQUEST')
  })

  it('returns 400 when text field is missing', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(400)
  })

  it('returns 201 with resumeId on success and uses extracted name for title', async () => {
    mockExtractResume.mockResolvedValueOnce({ basics: { name: 'Jane Smith' }, work: [] })
    mockCreateResume.mockResolvedValueOnce({ _id: 'resume123' })
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Jane Smith — Senior Engineer' }),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.resumeId).toBe('resume123')
    expect(mockCreateResume.mock.calls[0][1].title).toBe("Jane Smith's CV")
  })

  it('uses fallback title when no name is extracted', async () => {
    mockExtractResume.mockResolvedValueOnce({ skills: [{ name: 'React' }] })
    mockCreateResume.mockResolvedValueOnce({ _id: 'resume456' })
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'React developer with 5 years experience' }),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(201)
    expect(mockCreateResume.mock.calls[0][1].title).toMatch(/^Uploaded CV - \d{4}-\d{2}-\d{2}$/)
  })

  it('appends custom:<id> entries to meta.sectionOrder for extracted custom sections', async () => {
    mockExtractResume.mockResolvedValueOnce({
      basics: { name: 'Jane Smith' },
      customSections: [
        { id: 'cs-military', name: 'Military Service', enabledFields: [], items: [] },
        { id: 'cs-projects', name: 'Projects', enabledFields: [], items: [] },
      ],
    })
    mockCreateResume.mockResolvedValueOnce({ _id: 'resume789' })
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Jane Smith — Senior Engineer' }),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(201)
    const meta = mockCreateResume.mock.calls[0][1].meta
    expect(meta.sectionOrder).toEqual(['custom:cs-military', 'custom:cs-projects'])
  })

  it('excludes built-in sections with no extracted entries from meta.sectionOrder', async () => {
    mockExtractResume.mockResolvedValueOnce({
      basics: { name: 'Jane Smith' },
      work: [{ name: 'Acme', position: 'Engineer' }],
      skills: [],
    })
    mockCreateResume.mockResolvedValueOnce({ _id: 'resume999' })
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Jane Smith — Senior Engineer at Acme' }),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(201)
    const meta = mockCreateResume.mock.calls[0][1].meta
    expect(meta.sectionOrder).toEqual(['work'])
  })

  it('returns 422 when extractResume throws ExtractionError', async () => {
    const { ExtractionError } = await import('@/lib/upload/extract-resume')
    mockExtractResume.mockRejectedValueOnce(new ExtractionError('AI returned garbage'))
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'some cv text here' }),
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('EXTRACTION_FAILED')
  })
})
