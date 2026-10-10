// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { CoverLetterPanel } from './CoverLetterPanel'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [], fontScale: 1,
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, headers: new Headers(), json: async () => body }
}

const letterBox = () => screen.getByRole('textbox', { name: 'Cover letter' }) as HTMLTextAreaElement
const jdBox = () => screen.getByLabelText('Job description') as HTMLTextAreaElement
const writeButton = () => screen.getByRole('button', { name: /(write|rewrite) cover letter/i })

function pasteJob(text = 'We are looking for a Software Engineer.') {
  fireEvent.change(jdBox(), { target: { value: text } })
}

beforeEach(() => {
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
  vi.unstubAllGlobals()
})

describe('CoverLetterPanel: one letter box', () => {
  it('has exactly one letter textarea, bound to data.coverLetter, and edits write straight to it', () => {
    useResumeEditorStore.setState({ data: { coverLetter: 'Old letter.' } })
    render(<CoverLetterPanel />)
    expect(screen.getAllByRole('textbox').filter((t) => t.tagName === 'TEXTAREA')).toHaveLength(2) // job + letter
    expect(letterBox()).toHaveValue('Old letter.')
    fireEvent.change(letterBox(), { target: { value: 'My handwritten letter.' } })
    expect(useResumeEditorStore.getState().data.coverLetter).toBe('My handwritten letter.')
  })

  it('gives every field an accessible name', () => {
    render(<CoverLetterPanel />)
    expect(jdBox()).toBeInTheDocument()
    expect(screen.getByLabelText(/company/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role/i)).toBeInTheDocument()
    expect(letterBox()).toBeInTheDocument()
  })

  it('disables Write until a job is pasted, and never calls the API without one', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    render(<CoverLetterPanel />)
    expect(writeButton()).toBeDisabled()
    fireEvent.click(writeButton())
    expect(fetchMock).not.toHaveBeenCalled()
    pasteJob()
    expect(writeButton()).toBeEnabled()
  })

  it('a verified letter is written into the same box and the document in one undoable step', async () => {
    useResumeEditorStore.setState({ data: { coverLetter: 'Previous letter.' } })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ content: 'Dear team, ...', pendingApprovals: [] })))
    render(<CoverLetterPanel />)
    expect(writeButton()).toHaveTextContent('Rewrite cover letter')
    pasteJob()
    fireEvent.click(writeButton())

    await waitFor(() => expect(letterBox()).toHaveValue('Dear team, ...'))
    expect(useResumeEditorStore.getState().data.coverLetter).toBe('Dear team, ...')
    expect(screen.getByText(/letter written/i)).toBeInTheDocument()
    useResumeEditorStore.getState().undo()
    expect(useResumeEditorStore.getState().data.coverLetter).toBe('Previous letter.')
  })

  it('sends the job, company and role', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ content: 'Dear Hiring Manager, ...', pendingApprovals: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<CoverLetterPanel />)
    pasteJob()
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme Corp' } })
    fireEvent.change(screen.getByLabelText(/role/i), { target: { value: 'Senior Engineer' } })
    fireEvent.click(writeButton())
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/resumes/r1/cover-letter')
    expect(JSON.parse(opts.body)).toEqual({
      jobDescription: 'We are looking for a Software Engineer.',
      companyName: 'Acme Corp',
      roleName: 'Senior Engineer',
    })
  })

  it('shows the server error inline when writing fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'The model is busy.' }, false, 503)))
    render(<CoverLetterPanel />)
    pasteJob()
    fireEvent.click(writeButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('The model is busy.')
    expect(useResumeEditorStore.getState().data.coverLetter).toBeUndefined()
  })
})

describe('CoverLetterPanel: unverified claims', () => {
  const flagged = { content: 'I led a team of 40 people at Acme.', pendingApprovals: ['team of 40'] }

  async function writeFlagged() {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(flagged)))
    render(<CoverLetterPanel />)
    pasteJob()
    fireEvent.click(writeButton())
    await screen.findByRole('region', { name: 'Unverified details' })
  }

  it('holds the letter in the box, lists and highlights the claims, and does not save it yet', async () => {
    useResumeEditorStore.setState({ data: { coverLetter: 'Previous letter.' } })
    await writeFlagged()
    expect(letterBox()).toHaveValue(flagged.content)
    expect(useResumeEditorStore.getState().data.coverLetter).toBe('Previous letter.')
    const bar = screen.getByRole('region', { name: 'Unverified details' })
    expect(within(bar).getByText('team of 40')).toBeInTheDocument()
    expect(document.querySelector('mark')?.textContent).toBe('team of 40')
  })

  it('blocks copy and export until the letter is kept or discarded', async () => {
    await writeFlagged()
    for (const name of [/copy/i, /^pdf$/i, /^docx$/i]) expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('Keep letter writes the (possibly edited) letter to the document', async () => {
    await writeFlagged()
    fireEvent.change(letterBox(), { target: { value: 'I led a team at Acme.' } })
    expect(screen.getByText(/every unverified detail has been edited out/i)).toBeInTheDocument()
    expect(document.querySelector('mark')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Keep letter' }))
    expect(useResumeEditorStore.getState().data.coverLetter).toBe('I led a team at Acme.')
    expect(screen.queryByRole('region', { name: 'Unverified details' })).toBeNull()
  })

  it('Discard brings back the previous letter untouched', async () => {
    useResumeEditorStore.setState({ data: { coverLetter: 'Previous letter.' } })
    await writeFlagged()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(letterBox()).toHaveValue('Previous letter.')
    expect(useResumeEditorStore.getState().data.coverLetter).toBe('Previous letter.')
  })
})

describe('CoverLetterPanel: import from a link', () => {
  function openLinkMode() {
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('radio', { name: 'From a link' }))
  }

  it('imports the job text, fills empty company and role, and returns to the text view', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      text: 'Senior Engineer. Requirements: React.', title: 'Senior Engineer', company: 'Acme', source: 'structured', host: 'boards.greenhouse.io',
    }))
    vi.stubGlobal('fetch', fetchMock)
    openLinkMode()
    fireEvent.change(screen.getByLabelText('Job posting link'), { target: { value: 'https://boards.greenhouse.io/acme/1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))

    await waitFor(() => expect(jdBox()).toHaveValue('Senior Engineer. Requirements: React.'))
    expect(fetchMock.mock.calls[0][0]).toBe('/api/resumes/r1/job-description')
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ url: 'https://boards.greenhouse.io/acme/1' })
    expect(screen.getByLabelText(/company/i)).toHaveValue('Acme')
    expect(screen.getByLabelText(/role/i)).toHaveValue('Senior Engineer')
    expect(screen.getByText(/imported from boards.greenhouse.io/i)).toBeInTheDocument()
  })

  it('does not overwrite a company the user already typed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ text: 'Job text.', company: 'Scraped Co', host: 'x.com' })))
    render(<CoverLetterPanel />)
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'My Co' } })
    fireEvent.click(screen.getByRole('radio', { name: 'From a link' }))
    fireEvent.change(screen.getByLabelText('Job posting link'), { target: { value: 'https://x.com/job' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    await waitFor(() => expect(jdBox()).toHaveValue('Job text.'))
    expect(screen.getByLabelText(/company/i)).toHaveValue('My Co')
  })

  it("shows the server's reason when a page can't be imported, and stays on the link", async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ error: "Couldn't find a job description on that page." }, false, 422)))
    openLinkMode()
    fireEvent.change(screen.getByLabelText('Job posting link'), { target: { value: 'https://linkedin.com/jobs/1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't find a job description")
    expect(screen.getByLabelText('Job posting link')).toBeInTheDocument()
  })
})

describe('CoverLetterPanel: copy and export', () => {
  beforeEach(() => {
    useResumeEditorStore.setState({ data: { basics: { name: 'Jane Doe' }, coverLetter: 'Existing letter text.' } })
  })

  it('are disabled when there is no letter', () => {
    useResumeEditorStore.setState({ data: {} })
    render(<CoverLetterPanel />)
    for (const name of [/copy/i, /^pdf$/i, /^docx$/i]) expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('Copy writes the letter to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /copy/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Existing letter text.'))
    expect(await screen.findByText('Copied!')).toBeInTheDocument()
  })

  it('DOCX export posts the letter and names the file after the company', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['docx-bytes']) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    let downloaded = ''
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloaded = this.download
    })
    render(<CoverLetterPanel />)
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme Corp' } })
    fireEvent.click(screen.getByRole('button', { name: /^docx$/i }))

    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/resumes/r1/cover-letter/export/docx')
    expect(JSON.parse(opts.body)).toEqual({ content: 'Existing letter text.' })
    expect(downloaded).toBe('Cover-Letter-Acme-Corp.docx')
    clickSpy.mockRestore()
  })

  it('a failed export shows an inline error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 500, headers: new Headers(), json: async () => ({}) }))
    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByRole('button', { name: /^pdf$/i }))
    expect(await screen.findByText(/export failed/i)).toBeInTheDocument()
  })
})
