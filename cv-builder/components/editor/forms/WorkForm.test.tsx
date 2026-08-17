// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { WorkForm } from './WorkForm'
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
  expect(useResumeEditorStore.getState().data.work?.[0].roles?.[0].highlights).toHaveLength(1)
})

it('renders a drag handle per bullet so highlights can be reordered', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Acme', position: 'Dev', startDate: '', highlights: ['First', 'Second'] }] },
  })
  render(<WorkForm />)
  const bulletFieldset = screen.getByText('Bullet points').closest('fieldset') as HTMLElement
  expect(within(bulletFieldset).getAllByLabelText('Drag to reorder')).toHaveLength(2)
})

it('exposes accessible names for Company name and Job title via associated labels', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: '', roles: [{ id: 'r1', position: '' }] }] },
  })
  render(<WorkForm />)
  fireEvent.change(screen.getByLabelText('Company name'), { target: { value: 'Acme' } })
  expect(useResumeEditorStore.getState().data.work?.[0].name).toBe('Acme')
  fireEvent.change(screen.getByLabelText('Job title'), { target: { value: 'Engineer' } })
  expect(useResumeEditorStore.getState().data.work?.[0].roles?.[0].position).toBe('Engineer')
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

it('adds another role under the same company when "+ Add another role" is clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Meta', position: 'Data Analyst', startDate: '' }] },
  })
  render(<WorkForm />)
  fireEvent.click(screen.getByText('+ Add another role at Meta'))
  // The existing (legacy-field) role plus the newly-added one — both now
  // live in roles[] as equal entries, not "primary field + 1 extra".
  expect(useResumeEditorStore.getState().data.work?.[0].roles).toHaveLength(2)
})

it('labels the add-role button generically when the company name is blank', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: '', position: '', startDate: '' }] },
  })
  render(<WorkForm />)
  expect(screen.getByText('+ Add another role')).toBeInTheDocument()
})

it('updates a role field independently of the other role', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Meta', position: 'Data Analyst', startDate: '', roles: [{ id: 'r1', position: '', startDate: '', endDate: '', summary: '', highlights: [] }] }] },
  })
  render(<WorkForm />)
  const positionInputs = screen.getAllByPlaceholderText('Job title')
  fireEvent.change(positionInputs[1], { target: { value: 'Data Team Lead' } })
  // Editing any role folds the legacy top-level fields into roles[] too —
  // it becomes the single source of truth going forward.
  expect(useResumeEditorStore.getState().data.work?.[0].roles?.[0].position).toBe('Data Analyst')
  expect(useResumeEditorStore.getState().data.work?.[0].roles?.[1].position).toBe('Data Team Lead')
  expect(useResumeEditorStore.getState().data.work?.[0].position).toBeUndefined()
})

it('removes a role, leaving the other one intact in roles[]', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { work: [{ name: 'Meta', position: 'Data Analyst', startDate: '', roles: [{ id: 'r1', position: 'Lead', startDate: '', endDate: '', summary: '', highlights: [] }] }] },
  })
  render(<WorkForm />)
  const removeButtons = screen.getAllByLabelText('Remove role')
  expect(removeButtons).toHaveLength(2)
  fireEvent.click(removeButtons[1])
  const roles = useResumeEditorStore.getState().data.work?.[0].roles
  expect(roles).toHaveLength(1)
  expect(roles?.[0].position).toBe('Data Analyst')
})
