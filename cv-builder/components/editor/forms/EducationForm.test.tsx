// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { EducationForm } from './EducationForm'
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

it('adds an education entry when Add button clicked', () => {
  render(<EducationForm />)
  fireEvent.click(screen.getByText('+ Add education'))
  expect(useResumeEditorStore.getState().data.education).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
})

it('removes an education entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { education: [{ institution: 'MIT', studyType: 'BSc', area: 'CS' }] },
  })
  render(<EducationForm />)
  fireEvent.click(screen.getByLabelText('Remove education entry'))
  expect(useResumeEditorStore.getState().data.education).toHaveLength(0)
})

it('updates institution name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { education: [{ institution: '', studyType: '', area: '' }] },
  })
  render(<EducationForm />)
  fireEvent.change(screen.getByPlaceholderText('University / School'), { target: { value: 'MIT' } })
  expect(useResumeEditorStore.getState().data.education?.[0].institution).toBe('MIT')
})

it('adds another program under the same institution when "+ Add another program" is clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { education: [{ institution: 'MIT', studyType: 'BSc', area: 'CS' }] },
  })
  render(<EducationForm />)
  fireEvent.click(screen.getByText('+ Add another program at MIT'))
  // The existing (legacy-field) program plus the newly-added one — both now
  // live in roles[] as equal entries.
  expect(useResumeEditorStore.getState().data.education?.[0].roles).toHaveLength(2)
})

it('updates a role field independently of the other role', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { education: [{ institution: 'MIT', studyType: 'BSc', area: 'CS', roles: [{ id: 'r1', studyType: '', area: '', startDate: '', endDate: '', score: '', courses: [] }] }] },
  })
  render(<EducationForm />)
  const degreeInputs = screen.getAllByPlaceholderText('Degree (B.Sc.)')
  fireEvent.change(degreeInputs[1], { target: { value: 'MSc' } })
  expect(useResumeEditorStore.getState().data.education?.[0].roles?.[0].studyType).toBe('BSc')
  expect(useResumeEditorStore.getState().data.education?.[0].roles?.[1].studyType).toBe('MSc')
  expect(useResumeEditorStore.getState().data.education?.[0].studyType).toBeUndefined()
})

it('removes a role, leaving the other one intact in roles[]', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { education: [{ institution: 'MIT', studyType: 'BSc', roles: [{ id: 'r1', studyType: 'MSc', area: '', startDate: '', endDate: '', score: '', courses: [] }] }] },
  })
  render(<EducationForm />)
  const removeButtons = screen.getAllByLabelText('Remove role')
  expect(removeButtons).toHaveLength(2)
  fireEvent.click(removeButtons[1])
  const roles = useResumeEditorStore.getState().data.education?.[0].roles
  expect(roles).toHaveLength(1)
  expect(roles?.[0].studyType).toBe('BSc')
})
