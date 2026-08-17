// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { VolunteerForm } from './VolunteerForm'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

it('renders empty state with an Add volunteer experience button', () => {
  render(<VolunteerForm />)
  expect(screen.getByText('+ Add volunteer experience')).toBeInTheDocument()
  expect(useResumeEditorStore.getState().data.volunteer ?? []).toHaveLength(0)
})

it('adds a volunteer entry when Add button clicked', () => {
  render(<VolunteerForm />)
  fireEvent.click(screen.getByText('+ Add volunteer experience'))
  expect(useResumeEditorStore.getState().data.volunteer).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
  expect(screen.getByPlaceholderText('Organization')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Role')).toBeInTheDocument()
})

it('removes a volunteer entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { volunteer: [{ organization: 'Red Cross', position: 'Coordinator', url: '', startDate: '', endDate: '', summary: '', highlights: [] }] },
  })
  render(<VolunteerForm />)
  fireEvent.click(screen.getByLabelText('Remove volunteer entry'))
  expect(useResumeEditorStore.getState().data.volunteer).toHaveLength(0)
})

it('updates organization in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { volunteer: [{ organization: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [] }] },
  })
  render(<VolunteerForm />)
  fireEvent.change(screen.getByPlaceholderText('Organization'), { target: { value: 'Red Cross' } })
  expect(useResumeEditorStore.getState().data.volunteer?.[0].organization).toBe('Red Cross')
})

it('adds and updates a highlight', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { volunteer: [{ organization: 'Red Cross', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [] }] },
  })
  render(<VolunteerForm />)
  fireEvent.click(screen.getByText('+ Add highlight'))
  expect(useResumeEditorStore.getState().data.volunteer?.[0].highlights).toHaveLength(1)
})

it('renders an AI Suggest button next to the summary field and next to each highlight', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { volunteer: [{ organization: 'Red Cross', position: 'Coordinator', url: '', startDate: '', endDate: '', summary: 'Led a food drive', highlights: ['Recruited 20 volunteers'] }] },
  })
  render(<VolunteerForm />)
  const aiButtons = screen.getAllByRole('button', { name: /AI-written suggestion/i })
  expect(aiButtons).toHaveLength(2)
})
