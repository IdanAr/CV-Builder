// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { DesignPanel } from './DesignPanel'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1',
    title: 'CV',
    data: {},
    meta: defaultMeta,
    isDirty: false,
    isSaving: false,
    saveError: null,
  })
})

describe('DesignPanel', () => {
  it('renders template options', () => {
    render(<DesignPanel />)
    expect(screen.getByText('Classic')).toBeTruthy()
    expect(screen.getByText('Modern')).toBeTruthy()
    expect(screen.getByText('Minimal')).toBeTruthy()
  })

  it('clicking a template calls setMeta with the new templateId', () => {
    render(<DesignPanel />)
    fireEvent.click(screen.getByText('Modern'))
    expect(useResumeEditorStore.getState().meta.templateId).toBe('modern')
  })

  it('clicking layout toggle updates layout', () => {
    render(<DesignPanel />)
    fireEvent.click(screen.getByText('Two columns'))
    expect(useResumeEditorStore.getState().meta.layout).toBe('two-column')
  })
})
