// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AwardsForm } from './AwardsForm'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {},
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

it('renders empty state with an Add award button', () => {
  render(<AwardsForm />)
  expect(screen.getByText('+ Add award')).toBeInTheDocument()
  expect(useResumeEditorStore.getState().data.awards ?? []).toHaveLength(0)
})

it('adds an award entry when Add button clicked', () => {
  render(<AwardsForm />)
  fireEvent.click(screen.getByText('+ Add award'))
  expect(useResumeEditorStore.getState().data.awards).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
  expect(screen.getByPlaceholderText('Award title')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Awarder')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Summary...')).toBeInTheDocument()
})

it('removes an award entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { awards: [{ title: 'Employee of the Year', awarder: 'Acme', date: '', summary: '' }] },
  })
  render(<AwardsForm />)
  fireEvent.click(screen.getByLabelText('Remove award entry'))
  expect(useResumeEditorStore.getState().data.awards).toHaveLength(0)
})

it('updates award title in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { awards: [{ title: '', awarder: '', date: '', summary: '' }] },
  })
  render(<AwardsForm />)
  fireEvent.change(screen.getByPlaceholderText('Award title'), { target: { value: 'Employee of the Year' } })
  expect(useResumeEditorStore.getState().data.awards?.[0].title).toBe('Employee of the Year')
})

it('updates awarder in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { awards: [{ title: '', awarder: '', date: '', summary: '' }] },
  })
  render(<AwardsForm />)
  fireEvent.change(screen.getByPlaceholderText('Awarder'), { target: { value: 'Acme' } })
  expect(useResumeEditorStore.getState().data.awards?.[0].awarder).toBe('Acme')
})

it('updates summary in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { awards: [{ title: '', awarder: '', date: '', summary: '' }] },
  })
  render(<AwardsForm />)
  fireEvent.change(screen.getByPlaceholderText('Summary...'), { target: { value: 'Top performer' } })
  expect(useResumeEditorStore.getState().data.awards?.[0].summary).toBe('Top performer')
})
