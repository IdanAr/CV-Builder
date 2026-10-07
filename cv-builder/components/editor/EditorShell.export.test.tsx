// @vitest-environment jsdom
// Wires the REAL ExportMenu into EditorShell (EditorShell.test.tsx mocks it) so
// the (format, mode) each menu item sends to the export route is pinned.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditorShell } from './EditorShell'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), forward: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}))
vi.mock('./EditTab', () => ({ EditTab: () => <div /> }))
vi.mock('./PreviewTab', () => ({ PreviewTab: () => <div /> }))
vi.mock('./DesignPanel', () => ({ DesignPanel: () => <div /> }))
vi.mock('@/components/ats/AtsScorePanel', () => ({ AtsScorePanel: () => <div /> }))
vi.mock('@/components/coverletter/CoverLetterPanel', () => ({ CoverLetterPanel: () => <div /> }))

const meta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33,
  lineSpacing: 1.15,
  sectionOrder: ['work'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [], fontScale: 1,
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }))
  useResumeEditorStore.setState({ resumeId: 'r1', title: 'My CV', data: {}, meta, isDirty: false, isSaving: false, saveError: null })
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('EditorShell export menu wiring', () => {
  it.each([
    ['PDF - Designed', 'pdf', 'designed', 'My-CV-Classic.pdf'],
    ['PDF - ATS-optimized', 'pdf', 'ats', 'My-CV-Classic-ATS.pdf'],
    ['DOCX - Designed', 'docx', 'designed', 'My-CV-Classic.docx'],
    ['DOCX - ATS-optimized', 'docx', 'ats', 'My-CV-Classic-ATS.docx'],
  ])('"%s" POSTs mode to the %s export route and downloads the file', async (label, format, mode, filename) => {
    const fetchMock = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['x']) }))
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
    const downloads: string[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download)
    })

    render(<EditorShell resumeId="r1" title="My CV" data={{}} meta={meta} />)
    fireEvent.click(screen.getByRole('button', { name: /export/i }))
    fireEvent.click(screen.getByText(label))

    await waitFor(() => expect(downloads).toEqual([filename]))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`/api/resumes/r1/export/${format}`)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ mode })
  })
})
