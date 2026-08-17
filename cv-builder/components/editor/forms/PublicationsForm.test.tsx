// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { PublicationsForm } from './PublicationsForm'
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

it('renders empty state with an Add publication button', () => {
  render(<PublicationsForm />)
  expect(screen.getByText('+ Add publication')).toBeInTheDocument()
  expect(useResumeEditorStore.getState().data.publications ?? []).toHaveLength(0)
})

it('adds a publication entry when Add button clicked', () => {
  render(<PublicationsForm />)
  fireEvent.click(screen.getByText('+ Add publication'))
  expect(useResumeEditorStore.getState().data.publications).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
  expect(screen.getByPlaceholderText('Publication name')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Publisher')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('URL')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Summary...')).toBeInTheDocument()
})

it('removes a publication entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { publications: [{ name: 'My Paper', publisher: 'ACM', releaseDate: '', url: '', summary: '' }] },
  })
  render(<PublicationsForm />)
  fireEvent.click(screen.getByLabelText('Remove publication entry'))
  expect(useResumeEditorStore.getState().data.publications).toHaveLength(0)
})

it('updates publication name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { publications: [{ name: '', publisher: '', releaseDate: '', url: '', summary: '' }] },
  })
  render(<PublicationsForm />)
  fireEvent.change(screen.getByPlaceholderText('Publication name'), { target: { value: 'My Paper' } })
  expect(useResumeEditorStore.getState().data.publications?.[0].name).toBe('My Paper')
})

it('updates publisher in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { publications: [{ name: '', publisher: '', releaseDate: '', url: '', summary: '' }] },
  })
  render(<PublicationsForm />)
  fireEvent.change(screen.getByPlaceholderText('Publisher'), { target: { value: 'ACM' } })
  expect(useResumeEditorStore.getState().data.publications?.[0].publisher).toBe('ACM')
})

it('updates release date in store via month/year picker', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { publications: [{ name: '', publisher: '', releaseDate: '', url: '', summary: '' }] },
  })
  render(<PublicationsForm />)
  fireEvent.change(screen.getByLabelText('Release date year'), { target: { value: '2022' } })
  expect(useResumeEditorStore.getState().data.publications?.[0].releaseDate).toBe('2022')
})

it('updates url in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { publications: [{ name: '', publisher: '', releaseDate: '', url: '', summary: '' }] },
  })
  render(<PublicationsForm />)
  fireEvent.change(screen.getByPlaceholderText('URL'), { target: { value: 'https://example.com/paper' } })
  expect(useResumeEditorStore.getState().data.publications?.[0].url).toBe('https://example.com/paper')
})

it('updates summary in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { publications: [{ name: '', publisher: '', releaseDate: '', url: '', summary: '' }] },
  })
  render(<PublicationsForm />)
  fireEvent.change(screen.getByPlaceholderText('Summary...'), { target: { value: 'A paper about things' } })
  expect(useResumeEditorStore.getState().data.publications?.[0].summary).toBe('A paper about things')
})

it('renders an AI Suggest button next to the summary field', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { publications: [{ name: 'My Paper', publisher: 'ACM', releaseDate: '', url: '', summary: 'A paper about things' }] },
  })
  render(<PublicationsForm />)
  expect(screen.getByRole('button', { name: /AI-written suggestion/i })).toBeInTheDocument()
})
