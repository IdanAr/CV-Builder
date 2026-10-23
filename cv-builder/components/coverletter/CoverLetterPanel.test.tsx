// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useToastStore } from '@/lib/stores/toast.store'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'
import type { CoverLetterView, SuggestedPosting } from '@/lib/api/cover-letters'
import type { UseCoverLetters } from './use-cover-letters'
import { CoverLetterPanel } from './CoverLetterPanel'
import { Toaster } from '@/components/ui/Toaster'

const hook = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('./use-cover-letters', () => ({ useCoverLetters: () => hook.current }))

const flushSaveMock = vi.hoisted(() => vi.fn(async () => {}))
vi.mock('@/lib/stores/resume-editor.store', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stores/resume-editor.store')>()),
  flushSave: flushSaveMock,
}))

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [], fontScale: 1,
}

let seq = 0
function letter(over: Partial<CoverLetterView> = {}): CoverLetterView {
  seq += 1
  return {
    id: `l${seq}`,
    userId: 'u1',
    resumeId: 'r1',
    company: 'Acme Corp',
    role: 'Engineer',
    notes: {},
    content: 'Dear Acme Corp Hiring Team, I build things.',
    pendingApprovals: [],
    notices: [],
    language: 'en',
    status: 'ready',
    // Dates arrive as ISO strings over JSON, whatever the type says.
    createdAt: '2026-10-12T10:00:00.000Z' as unknown as Date,
    updatedAt: '2026-10-12T10:00:00.000Z' as unknown as Date,
    ...over,
  }
}

function mockHook(over: Partial<UseCoverLetters> = {}): UseCoverLetters {
  const value: UseCoverLetters = {
    letters: [],
    suggestedPosting: null,
    loading: false,
    error: null,
    // Like the real hook: the new letter joins the list before create resolves.
    create: vi.fn(async () => {
      const created = letter({ status: 'writing', progress: 'reading', content: '' })
      const cur = hook.current as UseCoverLetters
      hook.current = { ...cur, letters: [created, ...cur.letters] }
      return created
    }),
    save: vi.fn(),
    remove: vi.fn(async () => {}),
    flush: vi.fn(async () => true),
    postingFor: vi.fn(async () => null),
    ...over,
  }
  hook.current = value
  return value
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, headers: new Headers(), json: async () => body }
}

const jdBox = () => screen.getByLabelText('Job description') as HTMLTextAreaElement
const writeButton = () => screen.getByRole('button', { name: 'Write letter' })
const letterBox = () => screen.getByRole('textbox', { name: 'Cover letter' }) as HTMLTextAreaElement

function fillForm() {
  fireEvent.change(jdBox(), { target: { value: 'We are hiring a Platform Engineer.' } })
  fireEvent.change(screen.getByLabelText('Company'), { target: { value: 'Globex' } })
  fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'Platform Engineer' } })
}

beforeEach(() => {
  seq = 0
  flushSaveMock.mockReset()
  flushSaveMock.mockResolvedValue(undefined)
  useToastStore.setState({ toasts: [] })
  useResumeEditorStore.setState({
    resumeId: 'r1',
    title: 'CV',
    data: { basics: { name: 'Jane Doe' } },
    meta: defaultMeta,
    isDirty: false,
    isSaving: false,
    saveError: null,
    _history: [],
    _future: [],
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CoverLetterPanel: the letter list', () => {
  it("renders the CV's letters newest first, with company, role and date, plus New letter", () => {
    mockHook({
      letters: [
        letter({ company: 'Older Co', role: 'Analyst', createdAt: '2026-09-01T10:00:00.000Z' as unknown as Date }),
        letter({ company: 'Newer Co', role: 'Designer', createdAt: '2026-10-12T10:00:00.000Z' as unknown as Date }),
      ],
    })
    render(<CoverLetterPanel />)
    const items = screen.getAllByRole('button', { name: / at / }).filter((b) => !b.getAttribute('aria-label'))
    expect(items.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Designer at Newer Co'),
      expect.stringContaining('Analyst at Older Co'),
    ])
    expect(items[0]).toHaveTextContent('Oct 12, 2026')
    expect(screen.getByRole('button', { name: 'New letter' })).toBeInTheDocument()
  })

  it('a letter migrated from the old field without a target reads "Earlier letter"', () => {
    mockHook({ letters: [letter({ legacy: true, company: 'Unspecified', role: 'Unspecified' })] })
    render(<CoverLetterPanel />)
    expect(screen.getByRole('button', { name: /^Earlier letter/ })).toBeInTheDocument()
    expect(screen.queryByText(/Unspecified/)).toBeNull()
  })

  it('opens straight on the new-letter form when there are no letters and no suggestion', () => {
    mockHook()
    render(<CoverLetterPanel />)
    expect(jdBox()).toBeInTheDocument()
    expect(writeButton()).toBeDisabled()
  })

  it('shows a loading state, not the form, while the list loads', () => {
    mockHook({ loading: true })
    render(<CoverLetterPanel />)
    expect(screen.queryByLabelText('Job description')).toBeNull()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('shows the hook error', () => {
    mockHook({ letters: [letter()], error: 'Failed to load cover letters.' })
    render(<CoverLetterPanel />)
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load cover letters.')
  })
})

describe('CoverLetterPanel: new letter', () => {
  it('New letter, filled and submitted, calls create with the notes, then shows the letter being written', async () => {
    const h = mockHook({ letters: [letter()] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'New letter' }))
    expect(writeButton()).toBeDisabled()
    fillForm()
    fireEvent.change(screen.getByLabelText(/why this company or role/i), { target: { value: 'I use Globex daily.' } })
    fireEvent.change(screen.getByLabelText(/anything to explain/i), { target: { value: 'I took a year to study.' } })
    fireEvent.change(screen.getByLabelText(/hiring manager's name/i), { target: { value: 'Sam Lee' } })
    fireEvent.click(writeButton())

    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1))
    expect(h.create).toHaveBeenCalledWith({
      company: 'Globex',
      role: 'Platform Engineer',
      jobText: 'We are hiring a Platform Engineer.',
      notes: { motivation: 'I use Globex daily.', explain: 'I took a year to study.', hiringManager: 'Sam Lee' },
    })
    expect(await screen.findByText('Reading the posting')).toBeInTheDocument()
  })

  it('leaves empty notes out and caps the fields', async () => {
    const h = mockHook()
    render(<CoverLetterPanel />)
    fillForm()
    expect(screen.getByLabelText('Company')).toHaveAttribute('maxLength', '200')
    expect(screen.getByLabelText('Role')).toHaveAttribute('maxLength', '200')
    expect(screen.getByLabelText(/why this company or role/i)).toHaveAttribute('maxLength', '1000')
    expect(screen.getByLabelText(/anything to explain/i)).toHaveAttribute('maxLength', '1000')
    expect(screen.getByLabelText(/hiring manager's name/i)).toHaveAttribute('maxLength', '120')
    fireEvent.click(writeButton())
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1))
    expect(h.create).toHaveBeenCalledWith({
      company: 'Globex', role: 'Platform Engineer', jobText: 'We are hiring a Platform Engineer.', notes: {},
    })
  })

  it("starts a new letter's notes blank, whatever an earlier letter's notes say", () => {
    mockHook({ letters: [letter({ notes: { motivation: 'Old reason.', explain: 'I moved country in 2024.', hiringManager: 'Dana' } })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'New letter' }))
    expect(screen.getByLabelText(/why this company or role/i)).toHaveValue('')
    expect(screen.getByLabelText(/anything to explain/i)).toHaveValue('')
    expect(screen.getByLabelText(/hiring manager's name/i)).toHaveValue('')
  })

  it('keeps the form and its text when create fails', async () => {
    const h = mockHook({ create: vi.fn(async () => null) })
    render(<CoverLetterPanel />)
    fillForm()
    fireEvent.click(writeButton())
    await waitFor(() => expect(h.create).toHaveBeenCalled())
    expect(jdBox()).toHaveValue('We are hiring a Platform Engineer.')
  })

  it('shows a failed create next to Write letter as well, announced once', async () => {
    const message = 'Too many AI requests - please wait a moment.'
    const h = mockHook({ error: message, create: vi.fn(async () => null) })
    render(<CoverLetterPanel />)
    expect(screen.getAllByText(message)).toHaveLength(1)
    fillForm()
    fireEvent.click(writeButton())
    await waitFor(() => expect(h.create).toHaveBeenCalled())
    await waitFor(() => expect(screen.getAllByText(message)).toHaveLength(2))
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    const nearButton = screen.getAllByText(message).find((el) => el.closest('form'))
    expect(nearButton).toBeDefined()
  })

  it('imports the posting from a link and fills company and role', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      text: 'Senior Engineer. Requirements: React.', title: 'Senior Engineer', company: 'Initech', host: 'jobs.example.com',
    }))
    vi.stubGlobal('fetch', fetchMock)
    mockHook()
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('radio', { name: 'From a link' }))
    fireEvent.change(screen.getByLabelText('Job posting link'), { target: { value: 'https://jobs.example.com/1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(jdBox()).toHaveValue('Senior Engineer. Requirements: React.'))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/resumes/r1/job-description')
    expect(screen.getByLabelText('Company')).toHaveValue('Initech')
    expect(screen.getByLabelText('Role')).toHaveValue('Senior Engineer')
  })
})

describe('CoverLetterPanel: detected situation', () => {
  it('a gap in the CV shows the situation line above "Anything to explain"', () => {
    useResumeEditorStore.setState({
      data: {
        work: [
          { name: 'First Co', position: 'Dev', startDate: '2018-01', endDate: '2019-12' },
          { name: 'Second Co', position: 'Dev', startDate: '2021-06', endDate: 'Present' },
        ],
      },
    })
    mockHook()
    render(<CoverLetterPanel />)
    const line = screen.getByText(
      'Your CV shows no role from Jan 2020 to May 2021. If you want the letter to explain it, add a sentence here.'
    )
    const explain = screen.getByLabelText(/anything to explain/i)
    expect(line.compareDocumentPosition(explain) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(explain).toHaveAccessibleDescription(line.textContent!)
  })

  it('a gap after a year-only end date says "at least N months after"', () => {
    useResumeEditorStore.setState({
      data: {
        work: [
          { name: 'First Co', position: 'Dev', startDate: '2016', endDate: '2019' },
          { name: 'Second Co', position: 'Dev', startDate: '2021-06', endDate: 'Present' },
        ],
      },
    })
    mockHook()
    render(<CoverLetterPanel />)
    expect(screen.getByText(
      'Your CV shows no role for at least 17 months after 2019. If you want the letter to explain it, add a sentence here.'
    )).toBeInTheDocument()
  })

  it('no gap, no line', () => {
    useResumeEditorStore.setState({
      data: { work: [{ name: 'First Co', position: 'Dev', startDate: '2018-01', endDate: 'Present' }] },
    })
    mockHook()
    render(<CoverLetterPanel />)
    expect(screen.queryByText(/your cv shows no role/i)).toBeNull()
  })
})

describe('CoverLetterPanel: an open letter', () => {
  it('a writing letter shows its progress step as text in a live region', () => {
    mockHook({ letters: [letter({ status: 'writing', progress: 'critiquing', content: '' })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveTextContent('Checking it like an editor')
    expect(screen.queryByRole('textbox', { name: 'Cover letter' })).toBeNull()
  })

  it('the editor replaces the progress once the letter is ready', () => {
    const h = mockHook({ letters: [letter({ status: 'writing', progress: 'refining', content: '' })] })
    const { rerender } = render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(screen.getByText('Fixing flagged sentences')).toBeInTheDocument()
    mockHook({ ...h, letters: [{ ...h.letters[0], status: 'ready', progress: 'done', content: 'Dear team, hello.' }] })
    rerender(<CoverLetterPanel />)
    expect(letterBox()).toHaveValue('Dear team, hello.')
    expect(screen.queryByText('Fixing flagged sentences')).toBeNull()
  })

  it('a ready letter with 2 approvals shows both reasons and Keep this letter', () => {
    const l = letter({
      content: 'I led a team of 40 and grew revenue 3x.',
      pendingApprovals: ['number 40 not in cited fact F2', 'number 3x not in cited fact F5'],
    })
    const h = mockHook({ letters: [l] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    const box = screen.getByRole('region', { name: 'Unverified details' })
    expect(within(box).getByText('number 40 not in cited fact F2')).toBeInTheDocument()
    expect(within(box).getByText('number 3x not in cited fact F5')).toBeInTheDocument()
    for (const name of [/copy/i, /^pdf$/i, /^docx$/i]) expect(screen.getByRole('button', { name })).toBeDisabled()
    fireEvent.click(within(box).getByRole('button', { name: 'Keep this letter' }))
    expect(h.save).toHaveBeenCalledWith(l.id, { pendingApprovals: [] })
  })

  it('repeated reasons and notices each get their own line', () => {
    mockHook({ letters: [letter({ pendingApprovals: ['same reason', 'same reason'], notices: ['same notice', 'same notice'] })] })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(screen.getAllByText('same reason')).toHaveLength(2)
    expect(screen.getAllByText('same notice')).toHaveLength(2)
    expect(errors.mock.calls.some((c) => String(c[0]).includes('same key'))).toBe(false)
    errors.mockRestore()
  })

  it('caps the letter at the save limit', () => {
    mockHook({ letters: [letter()] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(letterBox()).toHaveAttribute('maxLength', '20000')
  })

  it('shows notices as plain info lines', () => {
    mockHook({ letters: [letter({ notices: ['The posting was cut to 10,000 characters.'] })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(screen.getByText('The posting was cut to 10,000 characters.')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Unverified details' })).toBeNull()
  })

  it('editing calls save and never setData', () => {
    const setData = vi.fn()
    useResumeEditorStore.setState({ setData, data: { coverLetter: 'Legacy text.' } })
    const l = letter()
    const h = mockHook({ letters: [l] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(letterBox()).toHaveValue(l.content)
    fireEvent.change(letterBox(), { target: { value: 'My own words.' } })
    expect(h.save).toHaveBeenCalledWith(l.id, { content: 'My own words.' })
    expect(setData).not.toHaveBeenCalled()
    expect(useResumeEditorStore.getState().data.coverLetter).toBe('Legacy text.')
  })

  it("saves the letter's notes on blur, not per keystroke", () => {
    const l = letter({ notes: { motivation: 'Old reason.' } })
    const h = mockHook({ letters: [l] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    const field = screen.getByLabelText(/why this company or role/i)
    expect(field).toHaveValue('Old reason.')
    fireEvent.change(field, { target: { value: 'New reason.' } })
    expect(h.save).not.toHaveBeenCalled()
    fireEvent.blur(field)
    expect(h.save).toHaveBeenCalledWith(l.id, { notes: { motivation: 'New reason.' } })
  })

  it('All letters goes back to the list', () => {
    mockHook({ letters: [letter()] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    fireEvent.click(screen.getByRole('button', { name: 'All letters' }))
    expect(screen.getByRole('button', { name: 'New letter' })).toBeInTheDocument()
  })
})

describe('CoverLetterPanel: a failed letter', () => {
  it('shows the error, and Try again opens the form prefilled from it', async () => {
    const l = letter({
      status: 'failed',
      error: 'Writing this letter took too long. Please try again.',
      company: 'Hooli', role: 'SRE', notes: { motivation: 'Big systems.' }, scrapedJobId: 'sj9', content: '',
    })
    const h = mockHook({ letters: [l] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^SRE at Hooli/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('Writing this letter took too long. Please try again.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByLabelText('Company')).toHaveValue('Hooli')
    expect(screen.getByLabelText('Role')).toHaveValue('SRE')
    expect(screen.getByLabelText(/why this company or role/i)).toHaveValue('Big systems.')
    fireEvent.change(jdBox(), { target: { value: 'SRE posting text.' } })
    fireEvent.click(writeButton())
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1))
    expect(h.create).toHaveBeenCalledWith({
      company: 'Hooli', role: 'SRE', jobText: 'SRE posting text.', notes: { motivation: 'Big systems.' }, scrapedJobId: 'sj9',
    })
  })
})

describe('CoverLetterPanel: Try again', () => {
  it("prefills the failed letter's own posting", async () => {
    const l = letter({ status: 'failed', error: 'Could not write this letter. Please try again.', company: 'Initech', role: 'Analyst', content: '' })
    const h = mockHook({ letters: [l], postingFor: vi.fn(async () => 'Initech needs an analyst.') })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Analyst at Initech/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(jdBox()).toHaveValue('Initech needs an analyst.'))
    expect(h.postingFor).toHaveBeenCalledWith(l.id)
    expect(writeButton()).toBeEnabled()
  })

  it('falls back to the suggested posting of the same job when the letter has none', async () => {
    const l = letter({ status: 'failed', company: 'Initech', role: 'Analyst', scrapedJobId: 'sj1', content: '' })
    const suggestedPosting: SuggestedPosting = { company: 'Initech', role: 'Analyst', jobText: 'Suggested posting text.', scrapedJobId: 'sj1' }
    mockHook({ letters: [l], suggestedPosting })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Analyst at Initech/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(jdBox()).toHaveValue('Suggested posting text.'))
  })
})

describe('CoverLetterPanel: Write a new version', () => {
  it('opens the form from a written letter, with its posting and its current notes, and writes nothing yet', async () => {
    const l = letter({ company: 'Initech', role: 'Analyst', notes: { motivation: 'Saved reason.' }, scrapedJobId: 'sj4' })
    const h = mockHook({ letters: [l], postingFor: vi.fn(async () => 'Initech needs an analyst.') })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Analyst at Initech/ }))
    // An edit to the notes that has not been blurred still counts.
    fireEvent.change(screen.getByLabelText(/anything to explain/i), { target: { value: 'Moved city in 2025.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Write a new version' }))
    await waitFor(() => expect(jdBox()).toHaveValue('Initech needs an analyst.'))
    expect(screen.getByLabelText('Company')).toHaveValue('Initech')
    expect(screen.getByLabelText('Role')).toHaveValue('Analyst')
    expect(screen.getByLabelText(/why this company or role/i)).toHaveValue('Saved reason.')
    expect(screen.getByLabelText(/anything to explain/i)).toHaveValue('Moved city in 2025.')
    expect(h.create).not.toHaveBeenCalled()

    fireEvent.click(writeButton())
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1))
    expect(h.create).toHaveBeenCalledWith({
      company: 'Initech', role: 'Analyst', jobText: 'Initech needs an analyst.',
      notes: { motivation: 'Saved reason.', explain: 'Moved city in 2025.' }, scrapedJobId: 'sj4',
    })
  })

  it('is only offered once a letter is written', () => {
    mockHook({ letters: [letter({ status: 'writing', progress: 'writing', content: '' })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(screen.queryByRole('button', { name: 'Write a new version' })).toBeNull()
  })
})

describe('CoverLetterPanel: delete', () => {
  it('hides the letter at once with an Undo toast, and deletes it after the undo window', async () => {
    vi.useFakeTimers()
    const l = letter({ company: 'Hooli', role: 'SRE' })
    const h = mockHook({ letters: [l, letter()] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete letter for SRE at Hooli' }))
    expect(screen.queryByRole('button', { name: /^SRE at Hooli/ })).toBeNull()
    expect(useToastStore.getState().toasts[0].message).toBe('Deleted letter for SRE at Hooli')
    expect(h.remove).not.toHaveBeenCalled()
    await act(async () => { vi.advanceTimersByTime(6000) })
    expect(h.remove).toHaveBeenCalledWith(l.id)
  })

  it('Undo brings the letter back and nothing is deleted', async () => {
    vi.useFakeTimers()
    const l = letter({ company: 'Hooli', role: 'SRE' })
    const h = mockHook({ letters: [l] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete letter for SRE at Hooli' }))
    act(() => { useToastStore.getState().toasts[0].onAction?.() })
    expect(screen.getByRole('button', { name: /^SRE at Hooli/ })).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(6000) })
    expect(h.remove).not.toHaveBeenCalled()
  })

  it('a pending delete is sent at once when the panel unmounts, and its toast goes with it', () => {
    const l = letter({ company: 'Hooli', role: 'SRE' })
    const h = mockHook({ letters: [l] })
    const { unmount } = render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete letter for SRE at Hooli' }))
    expect(useToastStore.getState().toasts).toHaveLength(1)
    unmount()
    expect(h.remove).toHaveBeenCalledWith(l.id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
  })

  it('the countdown pauses while the toast has focus, so a late Undo still works', async () => {
    vi.useFakeTimers()
    const l = letter({ company: 'Hooli', role: 'SRE' })
    const h = mockHook({ letters: [l] })
    render(<><CoverLetterPanel /><Toaster /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Delete letter for SRE at Hooli' }))
    await act(async () => { vi.advanceTimersByTime(4000) })
    const undo = screen.getByRole('button', { name: 'Undo' })
    fireEvent.focus(undo)
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(h.remove).not.toHaveBeenCalled()
    fireEvent.click(undo)
    expect(screen.getByRole('button', { name: /^SRE at Hooli/ })).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(10000) })
    expect(h.remove).not.toHaveBeenCalled()
  })

  it('Undo after the DELETE was sent does nothing', async () => {
    vi.useFakeTimers()
    const l = letter({ company: 'Hooli', role: 'SRE' })
    // The DELETE stays in flight.
    const h = mockHook({ letters: [l, letter()], remove: vi.fn(() => new Promise<void>(() => {})) })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete letter for SRE at Hooli' }))
    const onUndo = useToastStore.getState().toasts[0].onAction!
    await act(async () => { vi.advanceTimersByTime(6000) })
    expect(h.remove).toHaveBeenCalledWith(l.id)
    expect(useToastStore.getState().toasts).toHaveLength(0)
    act(() => { onUndo() })
    expect(screen.queryByRole('button', { name: /^SRE at Hooli/ })).toBeNull()
    expect(h.remove).toHaveBeenCalledTimes(1)
  })
})

describe('CoverLetterPanel: suggested posting', () => {
  const posting: SuggestedPosting = { company: 'Umbrella', role: 'Data Engineer', jobText: 'Umbrella needs a data engineer.', scrapedJobId: 'sj1' }

  it('the suggestion fills the form and makes no request; Write calls create with scrapedJobId', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const h = mockHook({ suggestedPosting: posting })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: 'Write a letter for Data Engineer at Umbrella' }))
    expect(jdBox()).toHaveValue('Umbrella needs a data engineer.')
    expect(screen.getByLabelText('Company')).toHaveValue('Umbrella')
    expect(screen.getByLabelText('Role')).toHaveValue('Data Engineer')
    expect(fetchMock).not.toHaveBeenCalled()
    expect(h.create).not.toHaveBeenCalled()

    fireEvent.click(writeButton())
    await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1))
    expect(h.create).toHaveBeenCalledWith({
      company: 'Umbrella', role: 'Data Engineer', jobText: 'Umbrella needs a data engineer.',
      notes: {}, scrapedJobId: 'sj1',
    })
  })
})

describe('CoverLetterPanel: copy and export act on the open letter', () => {
  function openReady() {
    mockHook({ letters: [letter({ content: 'Open letter text.' }), letter({ company: 'Other', role: 'Other role', content: 'Other text.' })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
  }

  it('Copy copies the open letter', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    openReady()
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Open letter text.'))
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  function stubDownload() {
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    const downloads: string[] = []
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    })
    return { downloads, clickSpy }
  }

  const exportResponse = (disposition?: string) => ({
    ok: true,
    headers: new Headers(disposition ? { 'Content-Disposition': disposition } : {}),
    blob: async () => new Blob(['bytes']),
  })

  it('DOCX export posts to the letter route with no body and saves under the name from the response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      exportResponse(`attachment; filename="Cover-Letter-Acme.docx"; filename*=UTF-8''Cover%20Letter%20-%20Acme%20Corp.docx`)
    )
    vi.stubGlobal('fetch', fetchMock)
    const { downloads, clickSpy } = stubDownload()
    openReady()
    fireEvent.click(screen.getByRole('button', { name: /^docx$/i }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/resumes/r1/cover-letters/l1/export/docx')
    expect(opts.method).toBe('POST')
    expect(opts.body).toBeUndefined()
    expect(downloads).toEqual(['Cover Letter - Acme Corp.docx'])
    clickSpy.mockRestore()
  })

  it('falls back to the ASCII filename, then to a name built from the company', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(exportResponse('attachment; filename="Cover-Letter-Acme.pdf"'))
      .mockResolvedValueOnce(exportResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { downloads, clickSpy } = stubDownload()
    openReady()
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    await waitFor(() => expect(downloads).toHaveLength(1))
    await waitFor(() => expect(screen.getByRole('button', { name: /^pdf$/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    await waitFor(() => expect(downloads).toHaveLength(2))
    expect(downloads).toEqual(['Cover-Letter-Acme.pdf', 'Cover-Letter-Acme-Corp.pdf'])
    clickSpy.mockRestore()
  })

  it('typing in the editor and clicking PDF sends no export request until the flush resolves', async () => {
    const order: string[] = []
    let release: () => void = () => {}
    const fetchMock = vi.fn().mockImplementation(async () => {
      order.push('fetch')
      return exportResponse()
    })
    vi.stubGlobal('fetch', fetchMock)
    const { clickSpy } = stubDownload()
    const hookValue = mockHook({
      letters: [letter({ content: 'Open letter text.' })],
      save: vi.fn(() => { order.push('save') }),
      flush: vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            order.push('flush')
            release = () => resolve(true)
          })
      ),
    })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    fireEvent.change(letterBox(), { target: { value: 'Edited text.' } })
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    await waitFor(() => expect(hookValue.flush).toHaveBeenCalled())
    // Give a missing await every chance to fire the request early.
    await act(async () => { await new Promise((r) => setTimeout(r, 20)) })
    expect(fetchMock).not.toHaveBeenCalled()

    await act(async () => { release() })
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    expect(hookValue.save).toHaveBeenCalledWith('l1', { content: 'Edited text.' })
    expect(order).toEqual(['save', 'flush', 'fetch'])
    expect(fetchMock.mock.calls[0][0]).toBe('/api/resumes/r1/cover-letters/l1/export/pdf')
    clickSpy.mockRestore()
  })

  it('a failed letter save stops the export: no request, and the message says nothing was exported', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { clickSpy } = stubDownload()
    const hookValue = mockHook({
      letters: [letter({ content: 'Open letter text.' })],
      flush: vi.fn(async () => false),
    })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save your last edit, so nothing was exported. Please try again."
    )
    expect(hookValue.flush).toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(clickSpy).not.toHaveBeenCalled()
    // The button is usable again for the retry.
    await waitFor(() => expect(screen.getByRole('button', { name: /^pdf$/i })).toBeEnabled())
    clickSpy.mockRestore()
  })

  it('the CV autosave is flushed before the letter flush, so the file and the picker agree', async () => {
    const order: string[] = []
    flushSaveMock.mockImplementation(async () => { order.push('cv') })
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => { order.push('fetch'); return exportResponse() }))
    const { clickSpy } = stubDownload()
    mockHook({
      letters: [letter({ content: 'Open letter text.' })],
      flush: vi.fn(async () => { order.push('letter'); return true }),
    })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    fireEvent.click(screen.getByRole('button', { name: /^docx$/i }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    expect(order).toEqual(['cv', 'letter', 'fetch'])
    clickSpy.mockRestore()
  })

  it('a failed CV save stops the export before the letter flush and any request', async () => {
    flushSaveMock.mockRejectedValue(new Error('offline'))
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const hookValue = mockHook({ letters: [letter({ content: 'Open letter text.' })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Couldn't save your latest changes before exporting. Please try again."
    )
    expect(hookValue.flush).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a Hebrew letter exports the same way: the server reads the language, the client sends nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(exportResponse())
    vi.stubGlobal('fetch', fetchMock)
    const { clickSpy } = stubDownload()
    mockHook({ letters: [letter({ content: 'שלום רב', language: 'he' })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
    clickSpy.mockRestore()
  })

  it('a 409 from the export shows its message in the export error line', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({ error: 'This letter has details waiting for your review.', code: 'CONFLICT' }),
      })
    )
    openReady()
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This letter has details waiting for your review.')
  })

  it('a failed export shows an inline error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({}) }))
    openReady()
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    expect(await screen.findByText(/export failed/i)).toBeInTheDocument()
  })
})

describe('CoverLetterPanel: design picker', () => {
  function openReady(over: Partial<CoverLetterView> = {}, hookOver: Partial<UseCoverLetters> = {}) {
    const value = mockHook({ letters: [letter(over)], ...hookOver })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    return value
  }
  const radio = (name: string) => screen.getByRole('radio', { name })

  it('shows Accent edge selected for a Modern CV when the letter has no design', () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, templateId: 'modern' } })
    openReady()
    expect(screen.getByRole('radiogroup', { name: /design/i })).toBeInTheDocument()
    expect(radio('Accent edge')).toBeChecked()
    expect(radio('Classic')).not.toBeChecked()
  })

  it('shows Classic selected for a Classic CV when the letter has no design', () => {
    openReady()
    expect(radio('Classic')).toBeChecked()
  })

  it("the letter's own design wins over the CV's template", () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, templateId: 'modern' } })
    openReady({ design: 'classic' })
    expect(radio('Classic')).toBeChecked()
  })

  it('clicking Classic saves the design on the open letter', () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, templateId: 'modern' } })
    const value = openReady()
    fireEvent.click(radio('Classic'))
    expect(value.save).toHaveBeenCalledWith('l1', { design: 'classic' })
  })

  it('arrow keys move the choice', () => {
    const value = openReady()
    fireEvent.keyDown(radio('Classic'), { key: 'ArrowRight' })
    expect(value.save).toHaveBeenCalledWith('l1', { design: 'accent-edge' })
  })

  it('is not shown for a letter that is still writing', () => {
    mockHook({ letters: [letter({ status: 'writing', progress: 'reading', content: '' })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('is not shown for a letter that failed', () => {
    mockHook({ letters: [letter({ status: 'failed', error: 'Could not write it.', content: '' })] })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^Engineer at Acme Corp/ }))
    expect(screen.getByText('Could not write it.')).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup')).toBeNull()
  })

  it('the group is named by the visible label, and a helper line says the CV styles it', () => {
    openReady()
    const group = screen.getByRole('radiogroup', { name: 'Design for PDF and DOCX' })
    expect(group).toBeInTheDocument()
    expect(screen.getByText("Uses your CV's colours and fonts.")).toBeInTheDocument()
  })
})
