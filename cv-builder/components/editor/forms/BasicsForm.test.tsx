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

it('migrates a legacy basics.url into the profiles list on render, unlabeled', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { basics: { url: 'https://janesmith.dev' } },
  })
  render(<BasicsForm />)
  expect(screen.getByDisplayValue('https://janesmith.dev')).toBeInTheDocument()
})

it('adds a new URL row when Add URL is clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { basics: {} },
  })
  render(<BasicsForm />)
  fireEvent.click(screen.getByText('+ Add URL'))
  expect(useResumeEditorStore.getState().data.basics?.profiles).toHaveLength(1)
})

it('persists the migrated URL into profiles and clears basics.url once any URL row is edited', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { basics: { url: 'https://janesmith.dev' } },
  })
  render(<BasicsForm />)
  fireEvent.change(screen.getByPlaceholderText('Label (optional — leave blank to show the link itself)'), {
    target: { value: 'Portfolio' },
  })
  const basics = useResumeEditorStore.getState().data.basics
  expect(basics?.url).toBeUndefined()
  expect(basics?.profiles).toEqual([{ id: 'migrated-url', label: 'Portfolio', url: 'https://janesmith.dev' }])
})

it('removes a URL row', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { basics: { profiles: [{ id: 'p1', label: '', url: 'https://a.dev' }] } },
  })
  render(<BasicsForm />)
  fireEvent.click(screen.getByLabelText('Remove URL'))
  expect(useResumeEditorStore.getState().data.basics?.profiles).toHaveLength(0)
})
