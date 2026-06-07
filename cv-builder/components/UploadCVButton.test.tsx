// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

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

  it('renders the Upload CV button in idle state', () => {
    render(<UploadCVButton />)
    expect(screen.getByRole('button', { name: /upload cv/i })).toBeTruthy()
  })

  it('shows "Reading filename…" (phase 1) while parse request is in flight', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}))
    render(<UploadCVButton />)
    triggerFileChange(makeFile('my-cv.pdf'))
    await waitFor(() => expect(screen.getByText(/Reading my-cv\.pdf/i)).toBeTruthy())
  })

  it('shows "Extracting information…" (phase 2) while extract request is in flight', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockImplementationOnce(() => new Promise(() => {}))
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByText(/Extracting information/i)).toBeTruthy())
  })

  it('redirects to editor on successful upload', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ resumeId: 'abc123' }) } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard/resumes/abc123'))
  })

  it('shows error message when parse API fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Could not read the file.' }),
    } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByText(/Could not read the file/i)).toBeTruthy())
  })

  it('shows error and "Try another file" button when extract API fails', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ text: 'cv text' }) } as Response)
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'AI failed.' }) } as Response)
    render(<UploadCVButton />)
    triggerFileChange(makeFile())
    await waitFor(() => expect(screen.getByRole('button', { name: /try another file/i })).toBeTruthy())
  })

  it('rejects oversized file client-side before any fetch', async () => {
    render(<UploadCVButton />)
    triggerFileChange(makeFile('big.pdf', 'application/pdf', 5 * 1024 * 1024 + 1))
    await waitFor(() => expect(screen.getByText(/5 MB/i)).toBeTruthy())
    expect(fetch).not.toHaveBeenCalled()
  })
})
