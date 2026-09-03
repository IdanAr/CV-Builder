// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { BasicsForm } from './BasicsForm'
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
  fireEvent.change(screen.getByPlaceholderText('Label - Optional'), {
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

// These are the user's own contact details, and the app declared no
// autoComplete anywhere at all — so browsers and password managers could not
// offer to fill in a single field, on the one form where that helps most.
describe('autofill', () => {
  it.each([
    ['Jane Smith', 'name'],
    ['Software Engineer', 'organization-title'],
    ['jane@example.com', 'email'],
    ['+1 555 123 4567', 'tel'],
    ['San Francisco', 'address-level2'],
    ['CA', 'address-level1'],
    ['US', 'country'],
  ])('offers autofill for the %s field', (placeholder, token) => {
    render(<BasicsForm />)
    expect(screen.getByPlaceholderText(placeholder).getAttribute('autocomplete')).toBe(token)
  })
})

describe('link rows', () => {
  // Both inputs carried a sibling `<label className="sr-only">` with no
  // htmlFor, which does not wrap the control either — so it named nothing and
  // the field's only identifier was its placeholder.
  it('names both link fields, and numbers them so rows stay distinguishable', () => {
    useResumeEditorStore.setState({
      ...useResumeEditorStore.getState(),
      data: {
        basics: {
          profiles: [
            { id: 'p1', label: 'GitHub', url: 'https://github.com/x' },
            { id: 'p2', label: 'Site', url: 'https://x.dev' },
          ],
        },
      },
    })
    render(<BasicsForm />)
    for (const name of ['Link 1 label', 'Link 1 URL', 'Link 2 label', 'Link 2 URL']) {
      expect(screen.getByLabelText(name)).toBeTruthy()
    }
  })

  it('offers URL autofill on the link field', () => {
    useResumeEditorStore.setState({
      ...useResumeEditorStore.getState(),
      data: { basics: { profiles: [{ id: 'p1', label: '', url: '' }] } },
    })
    render(<BasicsForm />)
    expect(screen.getByLabelText('Link 1 URL').getAttribute('autocomplete')).toBe('url')
  })
})
