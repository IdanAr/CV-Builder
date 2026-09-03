// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CustomSectionForm } from './CustomSectionForm'
import { useResumeEditorStore, type ResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { CustomSection, CustomSectionFieldType } from '@/lib/schemas/resume.zod'

vi.mock('@/lib/stores/resume-editor.store', () => ({
  useResumeEditorStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}))

const updateCustomSection = vi.fn()

const baseSection: CustomSection = {
  id: 'sec1',
  name: 'My Section',
  enabledFields: ['summary'] as CustomSectionFieldType[],
  items: [],
}

function mockStore(section: CustomSection) {
  const state = { resumeId: 'r1', data: { customSections: [section] }, updateCustomSection }
  vi.mocked(useResumeEditorStore).mockImplementation((sel) =>
    sel(state as unknown as ResumeEditorStore)
  )
  vi.mocked(useResumeEditorStore.getState).mockReturnValue(state as unknown as ReturnType<typeof useResumeEditorStore.getState>)
}

beforeEach(() => {
  updateCustomSection.mockClear()
  mockStore(baseSection)
})

describe('CustomSectionForm', () => {
  it('renders all 7 field toggle buttons', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /^subtitle$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^dates$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^url$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^text$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^bullets$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^keywords$/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^level$/i })).toBeTruthy()
  })

  it('active toggle (summary→Text) has indigo background class', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /^text$/i }).className).toContain('bg-indigo-500')
  })

  it('inactive toggle does not have indigo background', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /^subtitle$/i }).className).not.toContain('bg-indigo-500')
  })

  it('clicking inactive toggle calls updateCustomSection with the field added', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    fireEvent.click(screen.getByRole('button', { name: /^subtitle$/i }))
    expect(updateCustomSection).toHaveBeenCalledWith('sec1', {
      enabledFields: ['summary', 'subtitle'],
    })
  })

  it('clicking active toggle calls updateCustomSection with the field removed', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    fireEvent.click(screen.getByRole('button', { name: /^text$/i }))
    expect(updateCustomSection).toHaveBeenCalledWith('sec1', {
      enabledFields: [],
    })
  })

  it('renders "Add entry" button', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('button', { name: /add entry/i })).toBeTruthy()
  })

  it('returns nothing when section is not found', () => {
    render(<CustomSectionForm sectionId="nonexistent" />)
    expect(screen.queryByRole('button', { name: /^subtitle$/i })).toBeNull()
  })

  it('shows enabled field input for items when field is active', () => {
    const sectionWithItem: CustomSection = {
      ...baseSection,
      enabledFields: ['summary'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'My Entry', summary: 'Existing summary' }],
    }
    mockStore(sectionWithItem)
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByDisplayValue('Existing summary')).toBeTruthy()
  })

  it('renders an AI Suggest button next to the flat summary field and next to each highlight', () => {
    mockStore({
      ...baseSection,
      enabledFields: ['summary', 'highlights'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'My Entry', summary: 'Existing summary', highlights: ['Did a thing'] }],
    })
    render(<CustomSectionForm sectionId="sec1" />)
    const aiButtons = screen.getAllByRole('button', { name: /AI-written suggestion/i })
    expect(aiButtons).toHaveLength(2)
  })

  it('renders an AI Suggest button next to a role\'s summary field and next to each role highlight', () => {
    mockStore({
      id: 'cs1',
      name: 'Military Service',
      enabledFields: ['summary', 'highlights', 'roles'] as CustomSectionFieldType[],
      items: [{
        id: 'i1',
        title: 'IDF',
        roles: [{ id: 'r1', title: 'Commander', summary: 'Led a unit', highlights: ['Trained 30 recruits'] }],
      }],
    })
    render(<CustomSectionForm sectionId="cs1" />)
    const aiButtons = screen.getAllByRole('button', { name: /AI-written suggestion/i })
    expect(aiButtons).toHaveLength(2)
  })

  it('shows the Roles toggle in the field chips', () => {
    mockStore({
      id: 'cs1',
      name: 'Military Service',
      enabledFields: [] as CustomSectionFieldType[],
      items: [],
    })
    render(<CustomSectionForm sectionId="cs1" />)
    expect(screen.getByText('Roles')).toBeInTheDocument()
  })

  it('shows the add-role control on an item only when Roles is enabled', () => {
    mockStore({
      id: 'cs1',
      name: 'Military Service',
      enabledFields: ['roles'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'IDF' }],
    })
    render(<CustomSectionForm sectionId="cs1" />)
    expect(screen.getByText('+ Add role')).toBeInTheDocument()
  })

  it('adds a role to an item', () => {
    mockStore({
      id: 'cs1',
      name: 'Military Service',
      enabledFields: ['roles'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'IDF' }],
    })
    render(<CustomSectionForm sectionId="cs1" />)
    fireEvent.click(screen.getByText('+ Add role'))
    expect(updateCustomSection).toHaveBeenCalledWith('cs1', {
      items: [{ id: 'i1', title: 'IDF', roles: [expect.objectContaining({ id: expect.any(String) })] }],
    })
  })

  it('shows a role card seeded from legacy item.subtitle when Roles is toggled on for a pre-existing item', () => {
    mockStore({
      id: 'cs1',
      name: 'Military Service',
      enabledFields: ['subtitle', 'roles'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'IDF', subtitle: 'Team Commander' }],
    })
    render(<CustomSectionForm sectionId="cs1" />)
    // The legacy subtitle becomes the first (only) role's own subtitle field —
    // not lost, and not shown a second time as a flat item-level field.
    expect(screen.getByDisplayValue('Team Commander')).toBeTruthy()
  })

  it('folds the legacy role into roles[] and clears the flat fields once any role is edited', () => {
    mockStore({
      id: 'cs1',
      name: 'Military Service',
      enabledFields: ['subtitle', 'roles'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'IDF', subtitle: 'Team Commander' }],
    })
    render(<CustomSectionForm sectionId="cs1" />)
    fireEvent.click(screen.getByText('+ Add role'))
    const call = updateCustomSection.mock.calls[0]
    expect(call[0]).toBe('cs1')
    const updatedItem = call[1].items[0]
    expect(updatedItem.subtitle).toBeUndefined()
    expect(updatedItem.roles).toHaveLength(2)
    expect(updatedItem.roles[0].subtitle).toBe('Team Commander')
  })

  it('announces the enabled-fields group and each toggle\'s pressed state', () => {
    render(<CustomSectionForm sectionId="sec1" />)
    expect(screen.getByRole('group', { name: /enabled fields/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^text$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^subtitle$/i })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('CustomSectionForm accessible names', () => {
  // Three role-level controls shipped with no accessible name at all: two
  // inputs whose only identifier was a placeholder, and a select whose first
  // <option> is not a name. A screen reader announced them as bare "edit text"
  // and "combo box", so the fields were unusable without sight of the form.
  function renderRoleWithAllFields() {
    mockStore({
      id: 'sec1',
      name: 'Military Service',
      enabledFields: ['roles', 'subtitle', 'keywords', 'level'] as CustomSectionFieldType[],
      items: [{ id: 'i1', title: 'IDF', roles: [{ id: 'r1', title: 'Commander' }] }],
    })
    render(<CustomSectionForm sectionId="sec1" />)
  }

  it.each([
    ['Subtitle', 'textbox'],
    ['Add keyword', 'textbox'],
    ['Level', 'combobox'],
  ])('names the %s control', (name, role) => {
    renderRoleWithAllFields()
    expect(screen.getByRole(role, { name })).toBeTruthy()
  })

  it('keeps the level select usable by its name rather than its first option', () => {
    renderRoleWithAllFields()
    const select = screen.getByRole('combobox', { name: 'Level' })
    fireEvent.change(select, { target: { value: 'Expert' } })
    expect(updateCustomSection).toHaveBeenCalled()
  })
})
