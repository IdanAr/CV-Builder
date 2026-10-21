import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { _resetRateLimits } from '@/lib/rate-limit'
import { glyphRunsFromBuffer } from '@/lib/pdf/__tests__/pdf-geometry'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

const EN_BASICS = {
  name: 'Jordan Example',
  email: 'jordan@example.com',
  phone: '050-0000000',
  location: { city: 'Haifa' },
  profiles: [{ id: 'p1', network: 'LinkedIn', url: 'linkedin.com/in/jordan-example' }],
}
let mockBasics: Record<string, unknown> = EN_BASICS

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(async () => ({
    title: 'My Resume',
    data: { basics: mockBasics },
    meta: { fontFamily: 'Arial' },
  })),
}))

// Delegates to the real renderer so the content tests read the real PDF; the
// rate-limit test swaps in a stub so it does not render twenty documents.
vi.mock('@react-pdf/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-pdf/renderer')>()
  return { ...actual, renderToBuffer: vi.fn(actual.renderToBuffer) }
})

function req(content = 'Dear hiring manager,', language?: unknown): Request {
  return new Request('http://localhost/api/resumes/abc/cover-letter/export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, ...(language === undefined ? {} : { language }) }),
  })
}

async function exportText(language?: unknown, content = 'Dear hiring manager,'): Promise<{ lines: string[]; buffer: Buffer }> {
  const { POST } = await import('./route')
  const res = await POST(req(content, language) as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
  expect(res.status).toBe(200)
  const buffer = Buffer.from(await res.arrayBuffer())
  const runs = await glyphRunsFromBuffer(buffer)
  // Reading order: top of the page first.
  const lines = [...runs].sort((a, b) => b.y - a.y).map((r) => r.str)
  return { lines, buffer }
}

describe('POST /api/resumes/[id]/cover-letter/export/pdf', () => {
  beforeEach(async () => {
    _resetRateLimits()
    mockSession = { user: { id: 'user-1' } }
    mockBasics = EN_BASICS
    const actual = await vi.importActual<typeof import('@react-pdf/renderer')>('@react-pdf/renderer')
    vi.mocked(renderToBuffer).mockImplementation(actual.renderToBuffer as never)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('puts the name, the contact line and the date above the greeting', async () => {
    const { lines } = await exportText()
    const text = lines.join(' ')
    expect(text).toContain('Jordan Example')
    expect(text).toContain('jordan@example.com · 050-0000000 · Haifa · linkedin.com/in/jordan-example')
    expect(text).toContain('21 October 2026')
    const at = (needle: string) => text.indexOf(needle)
    expect(at('Jordan Example')).toBeLessThan(at('jordan@example.com'))
    expect(at('jordan@example.com')).toBeLessThan(at('21 October 2026'))
    expect(at('21 October 2026')).toBeLessThan(at('Dear hiring manager'))
  })

  it('writes the date in Hebrew and tags the file he-IL for a he letter', async () => {
    // Hebrew-only on purpose: the font chain garbles Latin and Hebrew letters
    // that share one document (see the task report), which is not under test here.
    mockBasics = { name: 'דנה לוי', phone: '050-0000000', location: { city: 'חיפה' } }
    const { lines, buffer } = await exportText('he', 'שלום רב')
    const text = lines.join(' ')
    // pdfjs splits an RTL word across runs, so check the glyphs rather than the word.
    for (const ch of new Set('באוקטובר')) expect(text).toContain(ch)
    expect(text).toContain('2026')
    expect(text).toContain('חיפה')
    expect(buffer.toString('latin1')).toContain('he-IL')
  })

  it('falls back to English for an unknown language', async () => {
    for (const bad of ['fr', 7, null, { x: 1 }]) {
      const { lines, buffer } = await exportText(bad)
      expect(lines.join(' ')).toContain('21 October 2026')
      expect(buffer.toString('latin1')).toContain('en-GB')
    }
  })

  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const res = await POST(req() as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })

  it('rate limits after the export budget is exhausted', async () => {
    vi.mocked(renderToBuffer).mockResolvedValue(Buffer.from('fake-pdf'))
    const { POST } = await import('./route')
    const { EXPORT_RATE_LIMIT } = await import('@/lib/rate-limit')
    for (let i = 0; i < EXPORT_RATE_LIMIT.limit; i++) {
      const res = await POST(req() as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
      expect(res.status).toBe(200)
    }
    const res = await POST(req() as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
