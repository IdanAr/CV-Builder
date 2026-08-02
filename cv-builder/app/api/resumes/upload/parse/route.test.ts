import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockParseFile = vi.fn()

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) =>
    handler(Object.assign(req, { auth: { user: { id: 'user1' } } }), ctx)
  ),
}))

vi.mock('@/lib/upload/parse-file', () => {
  class ParseError extends Error {
    constructor(msg: string) { super(msg); this.name = 'ParseError' }
  }
  return { parseFile: (...args: unknown[]) => mockParseFile(...args), ParseError }
})

describe('POST /api/resumes/upload/parse', () => {
  beforeEach(() => {
    mockParseFile.mockClear()
    vi.resetModules()
  })

  it('returns 401 when not authenticated', async () => {
    const { auth } = await import('@/lib/auth')
    vi.mocked(auth).mockImplementationOnce(
      (handler) => async (req: Request, ctx: unknown) =>
        handler(Object.assign(req, { auth: null }) as Parameters<typeof handler>[0], ctx as Parameters<typeof handler>[1])
    )
    const { POST } = await import('./route')
    const req = new Request('http://localhost/api/resumes/upload/parse', { method: 'POST' })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(401)
  })

  it('returns 400 when no file is provided', async () => {
    const { POST } = await import('./route')
    const formData = new FormData()
    const req = new Request('http://localhost/api/resumes/upload/parse', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('BAD_REQUEST')
  })

  it('returns 400 when file type is not PDF or DOCX', async () => {
    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('file', new File(['content'], 'resume.txt', { type: 'text/plain' }))
    const req = new Request('http://localhost/api/resumes/upload/parse', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('UNSUPPORTED_FORMAT')
  })

  it('returns 400 when file exceeds 4 MB', async () => {
    const { POST } = await import('./route')
    const bigContent = 'x'.repeat(4 * 1024 * 1024 + 1)
    const formData = new FormData()
    formData.append('file', new File([bigContent], 'big.pdf', { type: 'application/pdf' }))
    const req = new Request('http://localhost/api/resumes/upload/parse', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('FILE_TOO_LARGE')
  })

  it('returns 200 with extracted text when parseFile succeeds', async () => {
    mockParseFile.mockResolvedValueOnce('Jane Smith\nSenior Engineer\nAcme Corp')
    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('file', new File(['%PDF fake'], 'resume.pdf', { type: 'application/pdf' }))
    const req = new Request('http://localhost/api/resumes/upload/parse', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.text).toBe('Jane Smith\nSenior Engineer\nAcme Corp')
  })

  it('returns 422 when parseFile throws ParseError', async () => {
    const { ParseError } = await import('@/lib/upload/parse-file')
    mockParseFile.mockRejectedValueOnce(new ParseError('Scanned PDF detected'))
    const { POST } = await import('./route')
    const formData = new FormData()
    formData.append('file', new File(['fake'], 'resume.pdf', { type: 'application/pdf' }))
    const req = new Request('http://localhost/api/resumes/upload/parse', {
      method: 'POST',
      body: formData,
    })
    const res = await POST(req as never, {} as never) as Response
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('PARSE_FAILED')
  })
})
