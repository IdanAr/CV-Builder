// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ProjectsForm } from './ProjectsForm'
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

it('renders empty state with an Add project button', () => {
  render(<ProjectsForm />)
  expect(screen.getByText('+ Add project')).toBeInTheDocument()
  expect(useResumeEditorStore.getState().data.projects ?? []).toHaveLength(0)
})

it('adds a project entry when Add button clicked', () => {
  render(<ProjectsForm />)
  fireEvent.click(screen.getByText('+ Add project'))
  expect(useResumeEditorStore.getState().data.projects).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
  expect(screen.getByPlaceholderText('Project name')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Description...')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('URL')).toBeInTheDocument()
})

it('removes a project entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: 'CV Builder', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.click(screen.getByLabelText('Remove project entry'))
  expect(useResumeEditorStore.getState().data.projects).toHaveLength(0)
})

it('updates project name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.change(screen.getByPlaceholderText('Project name'), { target: { value: 'CV Builder' } })
  expect(useResumeEditorStore.getState().data.projects?.[0].name).toBe('CV Builder')
})

it('updates description in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.change(screen.getByPlaceholderText('Description...'), { target: { value: 'An AI CV builder' } })
  expect(useResumeEditorStore.getState().data.projects?.[0].description).toBe('An AI CV builder')
})

it('updates start date in store via month/year picker', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.change(screen.getByLabelText('Start date year'), { target: { value: '2023' } })
  expect(useResumeEditorStore.getState().data.projects?.[0].startDate).toBe('2023')
})

it('updates end date in store via month/year picker', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.change(screen.getByLabelText('End date year'), { target: { value: '2024' } })
  expect(useResumeEditorStore.getState().data.projects?.[0].endDate).toBe('2024')
})

it('updates url in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.change(screen.getByPlaceholderText('URL'), { target: { value: 'https://example.com/project' } })
  expect(useResumeEditorStore.getState().data.projects?.[0].url).toBe('https://example.com/project')
})

it('adds and removes a highlight', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.click(screen.getByText('+ Add highlight'))
  expect(useResumeEditorStore.getState().data.projects?.[0].highlights).toHaveLength(1)
  fireEvent.change(screen.getByPlaceholderText('Achievement...'), { target: { value: 'Shipped v1' } })
  expect(useResumeEditorStore.getState().data.projects?.[0].highlights?.[0]).toBe('Shipped v1')
  fireEvent.click(screen.getByLabelText('Remove highlight'))
  expect(useResumeEditorStore.getState().data.projects?.[0].highlights).toHaveLength(0)
})

it('adds and removes a keyword chip', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { projects: [{ name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '' }] },
  })
  render(<ProjectsForm />)
  fireEvent.click(screen.getByText('+ Add keyword'))
  expect(useResumeEditorStore.getState().data.projects?.[0].keywords).toHaveLength(1)
  fireEvent.change(screen.getByPlaceholderText('e.g. React'), { target: { value: 'React' } })
  expect(useResumeEditorStore.getState().data.projects?.[0].keywords?.[0]).toBe('React')
  fireEvent.click(screen.getByLabelText('Remove keyword'))
  expect(useResumeEditorStore.getState().data.projects?.[0].keywords).toHaveLength(0)
})
