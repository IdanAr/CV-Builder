// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { LanguagesForm } from './LanguagesForm'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

it('renders empty state with an Add language button', () => {
  render(<LanguagesForm />)
  expect(screen.getByText('+ Add language')).toBeInTheDocument()
  expect(useResumeEditorStore.getState().data.languages ?? []).toHaveLength(0)
})

it('adds a language entry when Add button clicked', () => {
  render(<LanguagesForm />)
  fireEvent.click(screen.getByText('+ Add language'))
  expect(useResumeEditorStore.getState().data.languages).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
  expect(screen.getByPlaceholderText('Language')).toBeInTheDocument()
})

it('removes a language entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { languages: [{ language: 'French', fluency: 'Native' }] },
  })
  render(<LanguagesForm />)
  fireEvent.click(screen.getByLabelText('Remove language'))
  expect(useResumeEditorStore.getState().data.languages).toHaveLength(0)
})

it('updates language name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { languages: [{ language: '', fluency: '' }] },
  })
  render(<LanguagesForm />)
  fireEvent.change(screen.getByPlaceholderText('Language'), { target: { value: 'French' } })
  expect(useResumeEditorStore.getState().data.languages?.[0].language).toBe('French')
})
