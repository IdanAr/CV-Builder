// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { CoverLetterPanel } from './CoverLetterPanel'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
}

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
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
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CoverLetterPanel', () => {
  it('renders the JD textarea and a disabled Generate button when there is no JD text', () => {
    render(<CoverLetterPanel />)
    expect(screen.getByPlaceholderText(/paste the job description/i)).toBeInTheDocument()
    expect(screen.getByText('Generate')).toBeDisabled()
  })

  it('clicking Generate with no JD text does nothing (fetch is never called)', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByText('Generate'))

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('a successful generate call shows a draft preview without writing to the store until accepted', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ content: 'Dear Hiring Manager, ...', pendingApprovals: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverLetterPanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), {
      target: { value: 'We are looking for a Software Engineer.' },
    })
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => expect(screen.getByText('Dear Hiring Manager, ...')).toBeInTheDocument())
    // Not yet written to the store — the draft requires explicit acceptance.
    expect(useResumeEditorStore.getState().data.coverLetter).toBeUndefined()

    fireEvent.click(screen.getByText('Use this letter'))

    await waitFor(() =>
      expect(useResumeEditorStore.getState().data.coverLetter).toBe('Dear Hiring Manager, ...')
    )
    expect(screen.getByDisplayValue('Dear Hiring Manager, ...')).toBeInTheDocument()

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/resumes/r1/cover-letter')
    const body = JSON.parse(opts.body)
    expect(body.jobDescription).toBe('We are looking for a Software Engineer.')
  })

  it('a response with pendingApprovals highlights the flagged claim and requires explicit acceptance', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ content: 'Grew revenue by 45%.', pendingApprovals: ['45%'] })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverLetterPanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), {
      target: { value: 'We are looking for a Software Engineer.' },
    })
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => expect(screen.getByText(/not in your original notes/i)).toBeInTheDocument())
    expect(screen.getByText('45%')).toBeInTheDocument()
    expect(useResumeEditorStore.getState().data.coverLetter).toBeUndefined()

    fireEvent.click(screen.getByText('Discard'))
    expect(screen.queryByText(/not in your original notes/i)).not.toBeInTheDocument()
    expect(useResumeEditorStore.getState().data.coverLetter).toBeUndefined()
  })

  it('editing the textarea directly updates data.coverLetter in the store', () => {
    useResumeEditorStore.setState({
      data: { basics: { name: 'Jane Doe' }, coverLetter: 'Existing letter text.' },
    })
    render(<CoverLetterPanel />)

    const letterTextarea = screen.getByDisplayValue('Existing letter text.')
    fireEvent.change(letterTextarea, { target: { value: 'Hand-edited letter text.' } })

    expect(useResumeEditorStore.getState().data.coverLetter).toBe('Hand-edited letter text.')
  })

  it('a failed fetch shows an inline error message', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverLetterPanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), {
      target: { value: 'We are looking for a Software Engineer.' },
    })
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => expect(screen.getByText(/could not generate|failed/i)).toBeInTheDocument())
  })

  it('Copy and Export buttons are disabled when there is no cover letter text', () => {
    render(<CoverLetterPanel />)
    expect(screen.getByText('Copy')).toBeDisabled()
    expect(screen.getByText('Export DOCX')).toBeDisabled()
    expect(screen.getByText('Export PDF')).toBeDisabled()
  })

  it('clicking Copy writes the cover letter text to the clipboard', async () => {
    useResumeEditorStore.setState({
      data: { basics: { name: 'Jane Doe' }, coverLetter: 'Existing letter text.' },
    })
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByText('Copy'))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('Existing letter text.'))
    await waitFor(() => expect(screen.getByText('Copied!')).toBeInTheDocument())
  })

  it('clicking Export DOCX posts the cover letter text and triggers a download', async () => {
    useResumeEditorStore.setState({
      data: { basics: { name: 'Jane Doe' }, coverLetter: 'Existing letter text.' },
    })
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['docx-bytes']) })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByText('Export DOCX'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/resumes/r1/cover-letter/export/docx')
    expect(JSON.parse(opts.body)).toEqual({ content: 'Existing letter text.' })
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())

    clickSpy.mockRestore()
  })

  it('a failed export shows an inline error message', async () => {
    useResumeEditorStore.setState({
      data: { basics: { name: 'Jane Doe' }, coverLetter: 'Existing letter text.' },
    })
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverLetterPanel />)
    fireEvent.click(screen.getByText('Export PDF'))

    await waitFor(() => expect(screen.getByText(/export failed/i)).toBeInTheDocument())
  })

  it('accepts optional company name and role name inputs and includes them in the request', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ content: 'Dear Hiring Manager, ...', pendingApprovals: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(<CoverLetterPanel />)
    fireEvent.change(screen.getByPlaceholderText(/paste the job description/i), {
      target: { value: 'We are looking for a Software Engineer.' },
    })
    fireEvent.change(screen.getByPlaceholderText(/company name/i), {
      target: { value: 'Acme Corp' },
    })
    fireEvent.change(screen.getByPlaceholderText(/role/i), {
      target: { value: 'Senior Engineer' },
    })
    fireEvent.click(screen.getByText('Generate'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.companyName).toBe('Acme Corp')
    expect(body.roleName).toBe('Senior Engineer')
  })
})
