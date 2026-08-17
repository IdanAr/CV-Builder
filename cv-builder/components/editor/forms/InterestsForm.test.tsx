// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { InterestsForm } from './InterestsForm'
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

it('renders empty state with an Add interest button', () => {
  render(<InterestsForm />)
  expect(screen.getByText('+ Add interest')).toBeInTheDocument()
  expect(useResumeEditorStore.getState().data.interests ?? []).toHaveLength(0)
})

it('adds an interest entry when Add button clicked', () => {
  render(<InterestsForm />)
  fireEvent.click(screen.getByText('+ Add interest'))
  expect(useResumeEditorStore.getState().data.interests).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
  expect(screen.getByPlaceholderText('Interest name')).toBeInTheDocument()
})

it('removes an interest entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { interests: [{ name: 'Hiking', keywords: [] }] },
  })
  render(<InterestsForm />)
  fireEvent.click(screen.getByLabelText('Remove interest entry'))
  expect(useResumeEditorStore.getState().data.interests).toHaveLength(0)
})

it('updates interest name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { interests: [{ name: '', keywords: [] }] },
  })
  render(<InterestsForm />)
  fireEvent.change(screen.getByPlaceholderText('Interest name'), { target: { value: 'Hiking' } })
  expect(useResumeEditorStore.getState().data.interests?.[0].name).toBe('Hiking')
})

it('adds a keyword chip and updates it in store', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { interests: [{ name: 'Hiking', keywords: [] }] },
  })
  render(<InterestsForm />)
  fireEvent.click(screen.getByText('+ Add keyword'))
  expect(useResumeEditorStore.getState().data.interests?.[0].keywords).toHaveLength(1)
  fireEvent.change(screen.getByPlaceholderText('e.g. Trail running'), { target: { value: 'Trail running' } })
  expect(useResumeEditorStore.getState().data.interests?.[0].keywords?.[0]).toBe('Trail running')
})

it('removes a keyword chip', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { interests: [{ name: 'Hiking', keywords: ['Trail running'] }] },
  })
  render(<InterestsForm />)
  fireEvent.click(screen.getByLabelText('Remove keyword'))
  expect(useResumeEditorStore.getState().data.interests?.[0].keywords).toHaveLength(0)
})
