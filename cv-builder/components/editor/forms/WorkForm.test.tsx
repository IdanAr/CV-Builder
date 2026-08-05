// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { WorkForm } from './WorkForm'
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

it('adds a work entry when Add button clicked', () => {
  render(<WorkForm />)
  fireEvent.click(screen.getByText('+ Add work experience'))
  expect(useResumeEditorStore.getState().data.work).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
})

it('removes a work entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Acme', position: 'Dev', startDate: '' }] },
  })
  render(<WorkForm />)
  fireEvent.click(screen.getByLabelText('Remove work entry'))
  expect(useResumeEditorStore.getState().data.work).toHaveLength(0)
})

it('updates company name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: '', position: '', startDate: '' }] },
  })
  render(<WorkForm />)
  fireEvent.change(screen.getByPlaceholderText('Company name'), { target: { value: 'Acme' } })
  expect(useResumeEditorStore.getState().data.work?.[0].name).toBe('Acme')
})

it('adds a highlight bullet', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Acme', position: 'Dev', startDate: '', highlights: [] }] },
  })
  render(<WorkForm />)
  fireEvent.click(screen.getByText('+ Add bullet'))
  expect(useResumeEditorStore.getState().data.work?.[0].highlights).toHaveLength(1)
})

it('exposes accessible names for Company name and Job title via associated labels', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: '', position: '', startDate: '' }] },
  })
  render(<WorkForm />)
  fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme' } })
  expect(useResumeEditorStore.getState().data.work?.[0].name).toBe('Acme')
  fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Engineer' } })
  expect(useResumeEditorStore.getState().data.work?.[0].position).toBe('Engineer')
})

it('gives each work entry its own unique field ids, so labels never cross-wire between entries', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: {
      work: [
        { name: 'Acme', position: 'Dev', startDate: '' },
        { name: 'Globex', position: 'PM', startDate: '' },
      ],
    },
  })
  render(<WorkForm />)
  const companyInputs = screen.getAllByLabelText('Company name')
  expect(companyInputs).toHaveLength(2)
  const ids = companyInputs.map((el) => el.id)
  expect(new Set(ids).size).toBe(2)
})
