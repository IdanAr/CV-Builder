import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { _resetRateLimits } from '@/lib/rate-limit'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(async () => ({
    title: 'My Resume',
    data: {
      basics: {
        name: 'Jordan Example',
        email: 'jordan@example.com',
        phone: '050-0000000',
        location: { city: 'Haifa' },
        profiles: [{ id: 'p1', network: 'LinkedIn', url: 'linkedin.com/in/jordan-example' }],
      },
    },
    meta: { fontFamily: 'Arial' },
  })),
}))

function req(content = 'Dear hiring manager,', language?: unknown): Request {
  return new Request('http://localhost/api/resumes/abc/cover-letter/export/docx', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, ...(language === undefined ? {} : { language }) }),
  })
}

async function exportParts(language?: unknown): Promise<{ xml: string; styles: string }> {
  const { POST } = await import('./route')
  const res = await POST(req('Dear hiring manager,', language) as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
  expect(res.status).toBe(200)
  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()))
  return {
    xml: await zip.file('word/document.xml')!.async('string'),
    styles: await zip.file('word/styles.xml')!.async('string'),
  }
}

describe('POST /api/resumes/[id]/cover-letter/export/docx', () => {
  beforeEach(() => {
    _resetRateLimits()
    mockSession = { user: { id: 'user-1' } }
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('puts the name, the contact line and the date above the greeting', async () => {
    const { xml } = await exportParts()
    const at = (needle: string) => xml.indexOf(needle)
    expect(at('Jordan Example')).toBeGreaterThan(-1)
    expect(at('jordan@example.com · 050-0000000 · Haifa · linkedin.com/in/jordan-example')).toBeGreaterThan(at('Jordan Example'))
    expect(at('21 October 2026')).toBeGreaterThan(at('jordan@example.com'))
    expect(at('Dear hiring manager')).toBeGreaterThan(at('21 October 2026'))
    // Single column: no tables, text boxes or multi-column sections.
    expect(xml).not.toMatch(/<w:tbl>|<w:txbxContent|<w:cols w:num="[2-9]"/)
  })

  it('writes the date in Hebrew and tags the document he-IL for a he letter', async () => {
    const { xml, styles } = await exportParts('he')
    expect(xml).toContain('21 באוקטובר 2026')
    expect(styles).toContain('he-IL')
  })

  it('falls back to English for an unknown language', async () => {
    for (const bad of ['fr', 7, null, { x: 1 }]) {
      const { xml, styles } = await exportParts(bad)
      expect(xml).toContain('21 October 2026')
      expect(styles).toContain('en-GB')
      expect(styles).not.toContain('he-IL')
    }
  })

  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { POST } = await import('./route')
    const res = await POST(req() as never, { params: Promise.resolve({ id: 'abc' }) } as never) as Response
    expect(res.status).toBe(401)
  })

  it('rate limits after the export budget is exhausted', async () => {
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
