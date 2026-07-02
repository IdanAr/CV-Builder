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
  const state = { data: { customSections: [section] }, updateCustomSection }
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
})
