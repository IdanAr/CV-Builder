'use client'

import { useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AccordionSection } from './AccordionSection'
import { BasicsForm } from './forms/BasicsForm'
import { WorkForm } from './forms/WorkForm'
import { EducationForm } from './forms/EducationForm'
import { SkillsForm } from './forms/SkillsForm'
import { CertificatesForm } from './forms/CertificatesForm'
import { ProjectsForm } from './forms/ProjectsForm'
import { LanguagesForm } from './forms/LanguagesForm'
import { VolunteerForm } from './forms/VolunteerForm'
import { AwardsForm } from './forms/AwardsForm'
import { PublicationsForm } from './forms/PublicationsForm'
import { InterestsForm } from './forms/InterestsForm'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const SECTION_LABELS: Record<string, string> = {
  basics: 'Personal Info', work: 'Work Experience', education: 'Education',
  skills: 'Skills', certificates: 'Certifications', projects: 'Projects',
  languages: 'Languages', volunteer: 'Volunteer', awards: 'Awards',
  publications: 'Publications', interests: 'Interests',
}

const SECTION_FORMS: Record<string, React.ComponentType> = {
  basics: BasicsForm, work: WorkForm, education: EducationForm,
  skills: SkillsForm, certificates: CertificatesForm, projects: ProjectsForm,
  languages: LanguagesForm, volunteer: VolunteerForm, awards: AwardsForm,
  publications: PublicationsForm, interests: InterestsForm,
}

function getBadge(section: string, data: ResumeData): string {
  if (section === 'basics') {
    const b = data.basics ?? {}
    const filled = [b.name, b.email, b.phone].filter(Boolean).length
    return filled > 0 ? `${filled} field${filled > 1 ? 's' : ''} filled` : 'empty'
  }
  const arr = (data as Record<string, unknown[]>)[section]
  return arr?.length ? `${arr.length} ${arr.length === 1 ? 'entry' : 'entries'}` : 'empty'
}

export function EditTab() {
  const [openSection, setOpenSection] = useState<string | null>('basics')
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const orderedSections = (meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : ['work', 'education', 'skills', 'certificates', 'awards', 'publications', 'volunteer', 'languages', 'interests', 'projects']
  ).filter((s) => s in SECTION_FORMS)

  const sectionOrder = ['basics', ...orderedSections]

  function moveSection(metaIdx: number, direction: 'up' | 'down') {
    const current = useResumeEditorStore.getState().meta.sectionOrder
    const order = [...current]
    const swapIdx = direction === 'up' ? metaIdx - 1 : metaIdx + 1
    ;[order[metaIdx], order[swapIdx]] = [order[swapIdx], order[metaIdx]]
    setMeta({ sectionOrder: order })
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-2 bg-transparent">
      {sectionOrder.map((section, idx) => {
        const FormComponent = SECTION_FORMS[section]
        if (!FormComponent) return null
        const metaIdx = idx - 1
        const isBasics = section === 'basics'
        return (
          <AccordionSection
            key={section}
            title={SECTION_LABELS[section] ?? section}
            badge={getBadge(section, data)}
            isOpen={openSection === section}
            onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
            onMoveUp={!isBasics && metaIdx > 0 ? () => moveSection(metaIdx, 'up') : undefined}
            onMoveDown={!isBasics && metaIdx < orderedSections.length - 1 ? () => moveSection(metaIdx, 'down') : undefined}
          >
            <FormComponent />
          </AccordionSection>
        )
      })}
    </div>
  )
}
