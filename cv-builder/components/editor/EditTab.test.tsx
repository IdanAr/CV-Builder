// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditTab } from './EditTab'
import { useResumeEditorStore, type ResumeEditorStore } from '@/lib/stores/resume-editor.store'
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
vi.mock('./forms/CertificatesForm', () => ({ CertificatesForm: () => <div>CertificatesForm</div> }))
vi.mock('./forms/AwardsForm', () => ({ AwardsForm: () => <div>AwardsForm</div> }))
vi.mock('./forms/PublicationsForm', () => ({ PublicationsForm: () => <div>PublicationsForm</div> }))
vi.mock('./forms/InterestsForm', () => ({ InterestsForm: () => <div>InterestsForm</div> }))
vi.mock('./forms/ProjectsForm', () => ({ ProjectsForm: () => <div>ProjectsForm</div> }))
vi.mock('./forms/CustomSectionForm', () => ({
  CustomSectionForm: ({ sectionId }: { sectionId: string }) => <div>CustomSectionForm:{sectionId}</div>,
}))
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

// Capture the onDragEnd callback registered by DndContext so tests can invoke it directly
let capturedOnDragEnd: ((event: { active: { id: string }; over: { id: string } | null }) => void) | null = null
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core')
  return {
    ...(actual as object),
    DndContext: ({ onDragEnd, children }: { onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => void; children: ReactNode }) => {
      capturedOnDragEnd = onDragEnd
      return <>{children}</>
    },
  }
})
vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual('@dnd-kit/sortable')
  return {
    ...(actual as object),   // keeps arrayMove from the real package
    SortableContext: ({ children }: { children: ReactNode }) => <>{children}</>,
    useSortable: () => ({
      listeners: undefined,
      attributes: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  }
})

const setMeta = vi.fn()
const addCustomSection = vi.fn()
const updateCustomSection = vi.fn()
const removeCustomSection = vi.fn()
const undo = vi.fn()
const redo = vi.fn()

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
  columnAssignment: {},
}

function setupStore(overrides: { sectionOrder?: string[]; customSections?: CustomSection[] } = {}) {
  const meta = { ...baseMeta, sectionOrder: overrides.sectionOrder ?? baseMeta.sectionOrder }
  const data = overrides.customSections ? { customSections: overrides.customSections } : {}
  const state = { meta, data, setMeta, addCustomSection, updateCustomSection, removeCustomSection, undo, redo }
  vi.mocked(useResumeEditorStore).mockImplementation((sel) => sel(state as unknown as ResumeEditorStore))
  ;(useResumeEditorStore as unknown as { getState: ReturnType<typeof vi.fn> }).getState.mockReturnValue(state)
}

beforeEach(() => {
  setMeta.mockClear()
  addCustomSection.mockClear()
  updateCustomSection.mockClear()
  removeCustomSection.mockClear()
  capturedOnDragEnd = null
  setupStore()
})

describe('EditTab — built-in sections', () => {
  it('renders Personal Info first, then sections in sectionOrder', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /^personal info/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /work experience/i }).length).toBeGreaterThan(0)
  })

  it('basics section has no delete button', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /delete personal info/i })).toBeNull()
  })

  it('does not render Undo or Redo buttons inside EditTab', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /redo/i })).toBeNull()
  })

  it('drag end calls setMeta with reordered sectionOrder', () => {
    render(<EditTab />)
    // Simulate dragging 'work' (index 0) to 'education' position (index 1)
    capturedOnDragEnd!({ active: { id: 'work' }, over: { id: 'education' } })
    expect(setMeta).toHaveBeenCalledWith({ sectionOrder: ['education', 'work', 'skills'] })
  })

  it('drag end with no over target does not call setMeta', () => {
    render(<EditTab />)
    capturedOnDragEnd!({ active: { id: 'work' }, over: null })
    expect(setMeta).not.toHaveBeenCalled()
  })

  it('drag end with same active and over does not call setMeta', () => {
    render(<EditTab />)
    capturedOnDragEnd!({ active: { id: 'work' }, over: { id: 'work' } })
    expect(setMeta).not.toHaveBeenCalled()
  })
})

describe('EditTab — sections absent from sectionOrder', () => {
  // baseMeta's sectionOrder fixture only includes work/education/skills, so
  // sections that exist as first-class forms (Sprint 2) but aren't listed
  // still don't render — sectionOrder is the source of truth for visibility.
  it('does not render Certificates section when absent from sectionOrder', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /^certificates/i })).toBeNull()
  })

  it('does not render Awards section when absent from sectionOrder', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /^awards/i })).toBeNull()
  })
})

describe('EditTab — new native sections (Sprint 2)', () => {
  it('renders Certificates, Awards, Publications, Interests, and Projects as accordion items with working forms when present in sectionOrder', () => {
    setupStore({
      sectionOrder: ['work', 'certificates', 'awards', 'publications', 'interests', 'projects'],
    })
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /^certificates/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^awards/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^publications/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^interests/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /^projects/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^certificates/i }))
    expect(screen.getByText('CertificatesForm')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^awards/i }))
    expect(screen.getByText('AwardsForm')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^publications/i }))
    expect(screen.getByText('PublicationsForm')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^interests/i }))
    expect(screen.getByText('InterestsForm')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /^projects/i }))
    expect(screen.getByText('ProjectsForm')).toBeTruthy()
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
