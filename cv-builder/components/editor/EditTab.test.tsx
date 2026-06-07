// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditTab } from './EditTab'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

vi.mock('@/lib/stores/resume-editor.store', () => ({
  useResumeEditorStore: Object.assign(vi.fn(), { getState: vi.fn() }),
}))

vi.mock('./forms/BasicsForm', () => ({ BasicsForm: () => <div>BasicsForm</div> }))
vi.mock('./forms/WorkForm', () => ({ WorkForm: () => <div>WorkForm</div> }))
vi.mock('./forms/EducationForm', () => ({ EducationForm: () => <div>EducationForm</div> }))
vi.mock('./forms/SkillsForm', () => ({ SkillsForm: () => <div>SkillsForm</div> }))
vi.mock('./forms/CertificatesForm', () => ({ CertificatesForm: () => <div>CertificatesForm</div> }))
vi.mock('./forms/ProjectsForm', () => ({ ProjectsForm: () => <div>ProjectsForm</div> }))
vi.mock('./forms/LanguagesForm', () => ({ LanguagesForm: () => <div>LanguagesForm</div> }))
vi.mock('./forms/VolunteerForm', () => ({ VolunteerForm: () => <div>VolunteerForm</div> }))
vi.mock('./forms/AwardsForm', () => ({ AwardsForm: () => <div>AwardsForm</div> }))
vi.mock('./forms/PublicationsForm', () => ({ PublicationsForm: () => <div>PublicationsForm</div> }))
vi.mock('./forms/InterestsForm', () => ({ InterestsForm: () => <div>InterestsForm</div> }))

const setMeta = vi.fn()
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

beforeEach(() => {
  setMeta.mockClear()
  vi.mocked(useResumeEditorStore).mockImplementation((sel: (s: any) => any) =>
    sel({ meta: baseMeta, data: {}, setMeta })
  )
  ;(useResumeEditorStore as any).getState.mockReturnValue({ meta: baseMeta, data: {}, setMeta })
})

describe('EditTab — section reordering', () => {
  it('renders Personal Info (basics) first, then sections in sectionOrder', () => {
    render(<EditTab />)
    expect(screen.getByRole('button', { name: /^personal info/i })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /work experience/i }).length).toBeGreaterThan(0)
  })

  it('basics section has no ↑↓ reorder buttons', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move personal info/i })).toBeNull()
  })

  it('first section in sectionOrder has ↓ but no ↑', () => {
    render(<EditTab />)
    expect(screen.queryByRole('button', { name: /move work experience up/i })).toBeNull()
    expect(screen.getByRole('button', { name: /move work experience down/i })).toBeTruthy()
  })

  it('clicking ↓ on a section calls setMeta with the swapped sectionOrder', () => {
    render(<EditTab />)
    fireEvent.click(screen.getByRole('button', { name: /move work experience down/i }))
    expect(setMeta).toHaveBeenCalledWith({ sectionOrder: ['education', 'work', 'skills'] })
  })
})
