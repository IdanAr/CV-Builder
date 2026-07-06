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
  excludedAtsKeywords: [],
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

  it('the Two columns option is not offered for the Minimal template', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, templateId: 'minimal' },
    })
    render(<DesignPanel />)
    expect(screen.queryByText('Two columns')).toBeNull()
    expect(screen.getByText('Single column')).toBeTruthy()
  })

  it('section columns block is hidden in single-column mode', () => {
    render(<DesignPanel />)
    expect(screen.queryByText('Section columns')).toBeNull()
  })

  it('section columns block is visible in two-column mode', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, layout: 'two-column' },
    })
    render(<DesignPanel />)
    expect(screen.getByText('Section columns')).toBeTruthy()
  })

  it('section columns block shows LEFT and RIGHT badges', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'skills'] },
    })
    render(<DesignPanel />)
    const leftBtns = screen.getAllByText('Left')
    const rightBtns = screen.getAllByText('Right')
    expect(leftBtns.length).toBeGreaterThan(0)
    expect(rightBtns.length).toBeGreaterThan(0)
  })

  it('clicking RIGHT badge updates columnAssignment', () => {
    useResumeEditorStore.setState({
      resumeId: 'r1', title: 'CV', isDirty: false, isSaving: false, saveError: null,
      data: {},
      meta: { ...defaultMeta, layout: 'two-column', sectionOrder: ['work', 'skills'] },
    })
    render(<DesignPanel />)
    // 'work' defaults to left — click Right to move it
    const rightBtns = screen.getAllByText('Right')
    fireEvent.click(rightBtns[0])
    expect(useResumeEditorStore.getState().meta.columnAssignment?.work).toBe('right')
  })
})
