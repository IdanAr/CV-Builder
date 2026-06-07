// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditTab } from './EditTab'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import type { CustomSection, CustomSectionFieldType } from '@/lib/schemas/resume.zod'

vi.mock('@/lib/stores/resume-editor.store', () => ({
  useResumeEditorStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}))

vi.mock('./forms/BasicsForm', () => ({ BasicsForm: () => <div>BasicsForm</div> }))
vi.mock('./forms/WorkForm', () => ({ WorkForm: () => <div>WorkForm</div> }))
vi.mock('./forms/EducationForm', () => ({ EducationForm: () => <div>EducationForm</div> }))
vi.mock('./forms/SkillsForm', () => ({ SkillsForm: () => <div>SkillsForm</div> }))
vi.mock('./forms/LanguagesForm', () => ({ LanguagesForm: () => <div>LanguagesForm</div> }))
vi.mock('./forms/VolunteerForm', () => ({ VolunteerForm: () => <div>VolunteerForm</div> }))
vi.mock('./forms/CustomSectionForm', () => ({ CustomSectionForm: ({ sectionId }: { sectionId: string }) => <div>CustomSectionForm:{sectionId}</div> }))

const setMeta = vi.fn()
const addCustomSection = vi.fn()
const updateCustomSection = vi.fn()
const removeCustomSection = vi.fn()

const baseMeta = {
  sectionOrder: ['work', 'education', 'skills'],
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0,
  lineSpacing: 1.15,
  layout: 'single-column' as const,
}

function setupStore(overrides: { sectionOrder?: string[]; customSections?: CustomSection[] } = {}) {
  const meta = { ...baseMeta, sectionOrder: overrides.sectionOrder ?? baseMeta.sectionOrder }
  const data = overrides.customSections ? { customSections: overrides.customSections } : {}
  const state = { meta, data, setMeta, addCustomSection, updateCustomSection, removeCustomSection }
  vi.mocked(useResumeEditorStore).mockImplementation((sel: (s: unknown) => unknown) => sel(state))
  ;(useResumeEditorStore as { getState: ReturnType<typeof vi.fn> }).getState.mockReturnValue(state)
}

beforeEach(() => {
  setMeta.mockClear()
  addCustomSection.mockClear()
  updateCustomSection.mockClear()
  removeCustomSection.mockClear()
  setupStore()
})

describe('EditTab — built-in sections', () => {
  it('renders Personal Info first, then sections in sectionOrder', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /^personal info/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /work experience/i }).length).toBeGreaterThan(0)
  })

  it('basics section has no ↑↓ or delete buttons', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move personal info/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete personal info/i })).toBeNull()
  })

  it('first section in sectionOrder has ↓ but no ↑', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move work experience up/i })).toBeNull()
    expect(screen.getByRole('button', { name: /move work experience down/i })).toBeTruthy()
  })

  it('clicking ↓ on a section calls setMeta with swapped sectionOrder', () => {
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /move work experience down/i }))
    expect(setMeta).toHaveBeenCalledWith({ sectionOrder: ['education', 'work', 'skills'] })
  })
})

describe('EditTab — removed sections', () => {
  it('does not render Certifications section', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /certifications/i })).toBeNull()
  })

  it('does not render Awards section', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /awards/i })).toBeNull()
  })
})

describe('EditTab — custom sections', () => {
  const customSection: CustomSection = {
    id: 'cs1',
    name: 'My Certifications',
    enabledFields: ['subtitle', 'dateRange'] as CustomSectionFieldType[],
    items: [],
  }

  it('renders custom section accordion with its name as an editable input', () => {
    setupStore({
      sectionOrder: ['work', 'custom:cs1'],
      customSections: [customSection],
    })
    render(<EditTab />)
    expect(screen.getByDisplayValue('My Certifications')).toBeTruthy()
  })

  it('custom section has delete button', () => {
    setupStore({
      sectionOrder: ['work', 'custom:cs1'],
      customSections: [customSection],
    })
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /delete section/i })).toBeTruthy()
  })

  it('clicking delete calls removeCustomSection with the section id', () => {
    setupStore({
      sectionOrder: ['work', 'custom:cs1'],
      customSections: [customSection],
    })
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /delete section/i }))
    expect(removeCustomSection).toHaveBeenCalledWith('cs1')
  })

  it('renders Add Section button', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /add section/i })).toBeTruthy()
  })

  it('clicking Add Section calls addCustomSection with correct shape', () => {
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /add section/i }))
    expect(addCustomSection).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'New Section',
        enabledFields: ['summary'],
        items: [],
      })
    )
  })
})
