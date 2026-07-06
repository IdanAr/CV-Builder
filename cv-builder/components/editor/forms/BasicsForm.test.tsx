// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { BasicsForm } from './BasicsForm'
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

it('updates basics.name in store when name input changes', () => {
  render(<BasicsForm />)
  fireEvent.change(screen.getByPlaceholderText('Jane Smith'), { target: { value: 'John Doe' } })
  expect(useResumeEditorStore.getState().data.basics?.name).toBe('John Doe')
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
})

it('updates basics.location.city in store', () => {
  render(<BasicsForm />)
  fireEvent.change(screen.getByPlaceholderText('San Francisco'), { target: { value: 'New York' } })
  expect(useResumeEditorStore.getState().data.basics?.location?.city).toBe('New York')
})

it('preserves existing fields when updating one', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { basics: { name: 'Jane', email: 'jane@test.com' } },
  })
  render(<BasicsForm />)
  fireEvent.change(screen.getByPlaceholderText('+1 555 123 4567'), { target: { value: '555-0000' } })
  const b = useResumeEditorStore.getState().data.basics
  expect(b?.name).toBe('Jane')
  expect(b?.email).toBe('jane@test.com')
  expect(b?.phone).toBe('555-0000')
})
