// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

const mockPush = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

const { default: UploadCVButton } = await import('./UploadCVButton')

function makeFile(name = 'resume.pdf', type = 'application/pdf', size = 1000) {
  return new File(['x'.repeat(size)], name, { type })
}

function triggerFileChange(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  fireEvent.change(input)
}

describe('UploadCVButton', () => {
  beforeEach(() => {
    mockPush.mockClear()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('renders the Upload CV button in idle state, with no modal open', () => {
    render(<UploadCVButton />)
    expect(screen.getByRole('button', { name: /upload cv/i })).toBeTruthy()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('makes the accepted file types and size limit available upfront via an accessible description, before any interaction', () => {
    render(<UploadCVButton />)
    const button = screen.getByRole('button', { name: /upload cv/i })
    const describedBy = button.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    expect(document.getElementById(describedBy!)?.textContent).toMatch(/PDF or DOCX.*4 MB/i)
    // Upfront, not just after a rejection: no fetch/interaction has happened yet.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('does not show the requirements caption in the button\'s own flex flow, so it stays aligned with sibling buttons', () => {
    render(<UploadCVButton />)
    // No hover/focus yet: the tooltip must not be rendered, and the always-in-DOM
    // accessible description must not be visually shown inline (only screen-reader-only).
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    const button = screen.getByRole('button', { name: /upload cv/i })
    const describedBy = document.getElementById(button.getAttribute('aria-describedby')!)
    expect(describedBy?.className).toMatch(/sr-only/)
  })

  it('shows a tooltip with the requirements text on hover, and hides it on mouse leave', () => {
    render(<UploadCVButton />)
    const button = screen.getByRole('button', { name: /upload cv/i })

    fireEvent.mouseEnter(button, { clientX: 100, clientY: 200 })
    expect(screen.getByRole('tooltip')).toHaveTextContent(/PDF or DOCX.*4 MB/i)

    fireEvent.mouseLeave(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('moves the tooltip to follow the cursor while hovering', () => {
    render(<UploadCVButton />)
    const button = screen.getByRole('button', { name: /upload cv/i })

    fireEvent.mouseEnter(button, { clientX: 50, clientY: 60 })
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '50px', top: '60px' })

    fireEvent.mouseMove(button, { clientX: 150, clientY: 260 })
    expect(screen.getByRole('tooltip')).toHaveStyle({ left: '150px', top: '260px' })
  })

  it('shows the tooltip on keyboard focus too, not just mouse hover', () => {
    render(<UploadCVButton />)
    const button = screen.getByRole('button', { name: /upload cv/i })

    fireEvent.focus(button)
    expect(screen.getByRole('tooltip')).toHaveTextContent(/PDF or DOCX.*4 MB/i)

    fireEvent.blur(button)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('still shows the requirements caption inline for the hero variant (standalone block, no alignment constraint)', () => {
    render(<UploadCVButton variant="hero" />)
    expect(screen.getByText(/PDF or DOCX.*4 MB/i)).toBeVisible()
  })

  it('opens the modal on stage "reading" while the parse request is in flight', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<UploadCVButton />)
    triggerFileChange(makeFile('my-cv.pdf'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('Reading my-cv.pdf…')).toBeTruthy()
  })

  it('moves the modal to stage "extracting" once the parse request resolves', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockImplementationOnce(() => new Promise(() => {}))
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByText('Extracting information…')).toBeTruthy())
  })

  it('redirects to the editor after the extract request resolves', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resumeId: 'abc123' }) } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/resumes/abc123'))
  })

  it('shows an error dialog when the parse API fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Could not read the file.' }),
    } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByText('Could not read the file.')).toBeTruthy())
  })

  it('shows an error dialog with "Try another file" when the extract API fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'AI failed.' }) } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByRole('button', { name: /try another file/i })).toBeTruthy())
  })

  it('clicking "Try another file" after an error closes the modal, ready for another upload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Could not read the file.' }),
    } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => screen.getByRole('button', { name: /try another file/i }))
    fireEvent.click(screen.getByRole('button', { name: /try another file/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('rejects an oversized file client-side before any fetch, showing the error in the modal', async () => {
    render(<UploadCVButton />)
    triggerFileChange(makeFile('big.pdf', 'application/pdf', 4 * 1024 * 1024 + 1))
    await waitFor(() => expect(screen.getByText(/File must be 4 MB or smaller/i)).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })

  it('aborts the in-flight request and closes the modal when Cancel is clicked while reading', async () => {
    let capturedSignal: AbortSignal | undefined
    vi.mocked(fetch).mockImplementationOnce((_url, init) => {
      capturedSignal = (init as RequestInit).signal as AbortSignal
      return new Promise(() => {})
    })
    render(<UploadCVButton />)
    triggerFileChange(makeFile('my-cv.pdf'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(capturedSignal?.aborted).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('ignores a parse response that resolves after cancel, instead of moving to "extracting"', async () => {
    let resolveParse!: (res: Response) => void
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveParse = resolve
        })
    )
    render(<UploadCVButton />)
    triggerFileChange(makeFile('my-cv.pdf'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    // Resolve the already-in-flight parse response *after* cancel, inside
    // act() with a real macrotask flush so every microtask in the
    // await-fetch -> await parseRes.json() -> setStage('extracting') chain
    // has a chance to run (and any resulting state update is captured, not
    // silently dropped past the assertions below).
    await act(async () => {
      resolveParse({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Extracting information…')).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('starts a fresh, non-aborted request on the next upload after a cancel', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<UploadCVButton />)
    triggerFileChange(makeFile('first.pdf'))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ resumeId: 'xyz789' }) } as Response)
    triggerFileChange(makeFile('second.pdf'))
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/resumes/xyz789'))
  })
})
