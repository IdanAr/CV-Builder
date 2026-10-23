import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { _resetRateLimits } from '@/lib/rate-limit'
import { glyphRunsFromBuffer, lineTexts, lineHasWord } from '@/lib/pdf/__tests__/pdf-geometry'

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

// Delegates to the real renderer so the content tests read the real PDF; the
// rate-limit test swaps in a stub so it does not render twenty documents.
vi.mock('@react-pdf/renderer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@react-pdf/renderer')>()
  return { ...actual, renderToBuffer: vi.fn(actual.renderToBuffer) }
})

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

const post = () => new Request('http://localhost/api/resumes/cv-1/cover-letters/l1/export/pdf', { method: 'POST' })
const ctx = { params: Promise.resolve({ id: 'cv-1', letterId: 'l1' }) } as never

async function run(): Promise<Response> {
  const { POST } = await import('./route')
  return (await POST(post() as never, ctx)) as Response
}

async function readText(res: Response): Promise<{ lines: string[]; visualLines: string[]; buffer: Buffer }> {
  expect(res.status).toBe(200)
  const buffer = Buffer.from(await res.arrayBuffer())
  const runs = await glyphRunsFromBuffer(buffer)
  const lines = [...runs].sort((a, b) => b.y - a.y).map((r) => r.str)
  return { lines, visualLines: lineTexts(runs), buffer }
}

/** The props the route handed to the PDF template on its last render. */
const renderedProps = () => (vi.mocked(renderToBuffer).mock.calls.at(-1)![0] as unknown as { props: Record<string, unknown> }).props

describe('POST /api/resumes/[id]/cover-letters/[letterId]/export/pdf', () => {
  beforeEach(async () => {
    _resetRateLimits()
    mockSession = { user: { id: 'user-1' } }
    mockResume = { title: 'My Resume', data: { basics: BASICS }, meta: { templateId: 'classic', fontFamily: 'Arial' } }
    mockLetter = freshLetter()
    const actual = await vi.importActual<typeof import('@react-pdf/renderer')>('@react-pdf/renderer')
    vi.mocked(renderToBuffer).mockReset()
    vi.mocked(renderToBuffer).mockImplementation(actual.renderToBuffer as never)
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

  it('puts the header, date, recipient and subject above the greeting', async () => {
    const { lines } = await readText(await run())
    const text = lines.join(' ')
    const at = (needle: string) => text.indexOf(needle)
    expect(at('Jordan Example')).toBeGreaterThan(-1)
    expect(at('jordan@example.com')).toBeGreaterThan(at('Jordan Example'))
    expect(at('21 October 2026')).toBeGreaterThan(at('jordan@example.com'))
    expect(at('Sam Rivers')).toBeGreaterThan(at('21 October 2026'))
    expect(at('Re: Data Analyst, Acme')).toBeGreaterThan(at('Sam Rivers'))
    expect(at('Dear hiring manager')).toBeGreaterThan(at('Re: Data Analyst, Acme'))
  })

  it('exports a legacy letter with no subject and no company line', async () => {
    mockLetter = freshLetter({ company: 'Unspecified', role: 'Unspecified', notes: {}, legacy: true })
    const { lines } = await readText(await run())
    const text = lines.join(' ')
    expect(text).not.toContain('Re:')
    expect(text).not.toContain('Unspecified')
    expect(text).toContain('Dear hiring manager')
  })

  it('follows the CV template when the letter has no design', async () => {
    await run()
    expect(renderedProps().design).toBe('classic')
    mockResume = { ...mockResume!, meta: { templateId: 'modern', fontFamily: 'Arial' } }
    await run()
    expect(renderedProps().design).toBe('accent-edge')
  })

  it('uses the letters own design when it is set', async () => {
    mockResume = { ...mockResume!, meta: { templateId: 'modern', fontFamily: 'Arial' } }
    mockLetter = freshLetter({ design: 'classic' })
    await run()
    expect(renderedProps().design).toBe('classic')
  })

  it('passes fonts, accent and font scale from the CV', async () => {
    mockResume = {
      ...mockResume!,
      meta: { templateId: 'classic', fontFamily: 'Arial', headerFontFamily: 'Georgia', accentColor: '#112233', fontScale: 1.1 },
    }
    await run()
    expect(renderedProps()).toMatchObject({ font: 'Arial', headerFont: 'Georgia', accentColor: '#112233', fontScale: 1.1 })
  })

  it('writes the date in Hebrew and tags the file he-IL for a he letter', async () => {
    mockResume = { ...mockResume!, data: { basics: { name: 'דנה לוי', email: 'dana@example.com', location: { city: 'חיפה' } } } }
    mockLetter = freshLetter({ language: 'he', content: 'שלום רב, אני כותבת בנוגע למשרה.', role: 'אנליסט', company: 'אקמי', notes: {} })
    const { visualLines, buffer } = await readText(await run())
    for (const word of ['באוקטובר', 'חיפה', 'שלום', 'בנוגע']) {
      expect(lineHasWord(visualLines, word), `"${word}" intact in ${JSON.stringify(visualLines)}`).toBe(true)
    }
    expect(buffer.toString('latin1')).toContain('he-IL')
  })

  it('names the file after the role and company, with an RFC 5987 name', async () => {
    const res = await run()
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    const disposition = res.headers.get('Content-Disposition')!
    expect(disposition).toContain('filename="Cover Letter - Data Analyst - Acme.pdf"')
    expect(disposition).toContain(`filename*=UTF-8''${encodeURIComponent('Cover Letter - Data Analyst - Acme.pdf')}`)
  })

  it('keeps a Hebrew role and company in the file name', async () => {
    mockLetter = freshLetter({ role: 'אנליסט', company: 'אקמי', language: 'he', content: 'שלום' })
    const disposition = (await run()).headers.get('Content-Disposition')!
    expect(disposition).toContain(encodeURIComponent('אנליסט'))
    expect(disposition).toContain(encodeURIComponent('אקמי'))
    expect(disposition).toMatch(/filename="[\x20-\x7e]+"/)
  })

  it('rate limits after the export budget is exhausted', async () => {
    vi.mocked(renderToBuffer).mockResolvedValue(Buffer.from('fake-pdf'))
    const { EXPORT_RATE_LIMIT } = await import('@/lib/rate-limit')
    for (let i = 0; i < EXPORT_RATE_LIMIT.limit; i++) {
      expect((await run()).status).toBe(200)
    }
    const res = await run()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBeTruthy()
  })
})
