import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import JSZip from 'jszip'
import { _resetRateLimits } from '@/lib/rate-limit'

let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } }

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

const BASICS = {
  name: 'Jordan Example',
  email: 'jordan@example.com',
  phone: '050-0000000',
  location: { city: 'Haifa' },
}
let mockResume: Record<string, unknown> | null = null
let mockLetter: Record<string, unknown> | null = null

vi.mock('@/lib/api/resumes', () => ({ getResume: vi.fn(async () => mockResume) }))
vi.mock('@/lib/api/cover-letters', () => ({ getCoverLetter: vi.fn(async () => mockLetter) }))

const BODY = 'Dear hiring manager,\n\nI would like to apply.\n\nKind regards,\nJordan'

function freshLetter(over: Record<string, unknown> = {}) {
  return {
    id: 'l1',
    content: BODY,
    company: 'Acme',
    role: 'Data Analyst',
    notes: { hiringManager: 'Sam Rivers' },
    language: 'en',
    status: 'ready',
    pendingApprovals: [],
    ...over,
  }
}

const post = () => new Request('http://localhost/api/resumes/cv-1/cover-letters/l1/export/docx', { method: 'POST' })
const ctx = { params: Promise.resolve({ id: 'cv-1', letterId: 'l1' }) } as never

async function run(): Promise<Response> {
  const { POST } = await import('./route')
  return (await POST(post() as never, ctx)) as Response
}

async function parts(res: Response): Promise<{ xml: string; styles: string }> {
  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()))
  return {
    xml: await zip.file('word/document.xml')!.async('string'),
    styles: await zip.file('word/styles.xml')!.async('string'),
  }
}

describe('POST /api/resumes/[id]/cover-letters/[letterId]/export/docx', () => {
  beforeEach(() => {
    _resetRateLimits()
    mockSession = { user: { id: 'user-1' } }
    mockResume = { title: 'My Resume', data: { basics: BASICS }, meta: { templateId: 'classic', fontFamily: 'Arial' } }
    mockLetter = freshLetter()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-21T09:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns 401 when not authenticated', async () => {
    mockSession = null
    expect((await run()).status).toBe(401)
  })

  it('returns 404 when the CV is not the users', async () => {
    mockResume = null
    expect((await run()).status).toBe(404)
  })

  it('returns 404 for a missing letter', async () => {
    mockLetter = null
    expect((await run()).status).toBe(404)
  })

  it('returns 409 while the letter is still being written', async () => {
    mockLetter = freshLetter({ status: 'writing', content: '' })
    const res = await run()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'CONFLICT', error: 'This letter is still being written.' })
  })

  it('returns 409 while sentences are waiting for approval', async () => {
    mockLetter = freshLetter({ pendingApprovals: ['I grew sales 300%.'] })
    const res = await run()
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ code: 'CONFLICT', error: 'Keep or edit the flagged sentences before exporting.' })
  })

  it('returns 409 for a blank letter', async () => {
    mockLetter = freshLetter({ content: '  \n ' })
    expect((await run()).status).toBe(409)
  })

  it('writes the header, recipient, subject and body in order', async () => {
    const res = await run()
    expect(res.status).toBe(200)
    const { xml } = await parts(res)
    const at = (needle: string) => xml.indexOf(needle)
    expect(at('Jordan Example')).toBeGreaterThan(-1)
    expect(at('jordan@example.com · 050-0000000 · Haifa')).toBeGreaterThan(at('Jordan Example'))
    expect(at('21 October 2026')).toBeGreaterThan(at('Haifa'))
    expect(at('Sam Rivers')).toBeGreaterThan(at('21 October 2026'))
    expect(at('Acme')).toBeGreaterThan(at('Sam Rivers'))
    expect(at('Re: Data Analyst, Acme')).toBeGreaterThan(at('Acme'))
    expect(at('Dear hiring manager')).toBeGreaterThan(at('Re: Data Analyst, Acme'))
    expect(xml).not.toMatch(/<w:tbl>|<w:txbxContent|<w:cols w:num="[2-9]"/)
  })

  it('exports a legacy letter with no subject and no company line', async () => {
    mockLetter = freshLetter({ company: 'Unspecified', role: 'Unspecified', notes: {}, legacy: true })
    const { xml } = await parts(await run())
    expect(xml).not.toContain('Re:')
    expect(xml).not.toContain('Unspecified')
    expect(xml).toContain('Dear hiring manager')
  })

  it('follows the CV template when the letter has no design', async () => {
    const classic = await parts(await run())
    expect(classic.xml).toContain('<w:bottom')
    expect(classic.xml).not.toContain('<w:left w:val="single"')

    mockResume = { ...mockResume!, meta: { templateId: 'modern', fontFamily: 'Arial' } }
    const edge = await parts(await run())
    expect(edge.xml).toContain('<w:left w:val="single"')
  })

  it('uses the letters own design when it is set', async () => {
    mockResume = { ...mockResume!, meta: { templateId: 'modern', fontFamily: 'Arial' } }
    mockLetter = freshLetter({ design: 'classic' })
    const { xml } = await parts(await run())
    expect(xml).toContain('<w:bottom')
    expect(xml).not.toContain('<w:left w:val="single"')
  })

  it('writes the date in Hebrew and tags the document he-IL for a he letter', async () => {
    mockLetter = freshLetter({ language: 'he' })
    const { xml, styles } = await parts(await run())
    expect(xml).toContain('21 באוקטובר 2026')
    expect(styles).toContain('he-IL')
  })

  it('applies the CV font scale to the file', async () => {
    const sizes = (xml: string) => [...xml.matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => m[1]).join(',')
    const plain = await parts(await run())
    mockResume = { ...mockResume!, meta: { templateId: 'classic', fontFamily: 'Arial', fontScale: 1.1 } }
    const scaled = await parts(await run())
    expect(sizes(scaled.xml)).not.toBe(sizes(plain.xml))
  })

  it('names the file after the role and company, with an RFC 5987 name', async () => {
    const res = await run()
    expect(res.headers.get('Content-Type')).toContain('wordprocessingml')
    const disposition = res.headers.get('Content-Disposition')!
    expect(disposition).toContain('filename="Cover Letter - Data Analyst - Acme.docx"')
    expect(disposition).toContain(`filename*=UTF-8''${encodeURIComponent('Cover Letter - Data Analyst - Acme.docx')}`)
  })

  it('keeps a Hebrew role and company in the file name', async () => {
    mockLetter = freshLetter({ role: 'אנליסט', company: 'אקמי', language: 'he' })
    const disposition = (await run()).headers.get('Content-Disposition')!
    expect(disposition).toContain(encodeURIComponent('אנליסט'))
    expect(disposition).toContain(encodeURIComponent('אקמי'))
    expect(disposition).toMatch(/filename="[\x20-\x7e]+"/)
  })

  it('rate limits after the export budget is exhausted', async () => {
    const { EXPORT_RATE_LIMIT } = await import('@/lib/rate-limit')
    for (let i = 0; i < EXPORT_RATE_LIMIT.limit; i++) {
      expect((await run()).status).toBe(200)
    }
    const res = await run()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
