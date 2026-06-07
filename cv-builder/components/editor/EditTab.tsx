'use client'

import { useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AccordionSection } from './AccordionSection'
import { BasicsForm } from './forms/BasicsForm'
import { WorkForm } from './forms/WorkForm'
import { EducationForm } from './forms/EducationForm'
import { SkillsForm } from './forms/SkillsForm'
import { LanguagesForm } from './forms/LanguagesForm'
import { VolunteerForm } from './forms/VolunteerForm'
import { CustomSectionForm } from './forms/CustomSectionForm'
import type { ResumeData, CustomSection } from '@/lib/schemas/resume.zod'

const SECTION_LABELS: Record<string, string> = {
  basics: 'Personal Info',
  work: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  volunteer: 'Volunteer',
}

const SECTION_FORMS: Record<string, React.ComponentType> = {
  basics: BasicsForm,
  work: WorkForm,
  education: EducationForm,
  skills: SkillsForm,
  languages: LanguagesForm,
  volunteer: VolunteerForm,
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

function getCustomBadge(section: CustomSection): string {
  return section.items.length > 0
    ? `${section.items.length} ${section.items.length === 1 ? 'entry' : 'entries'}`
    : 'empty'
}

export function EditTab() {
  const [openSection, setOpenSection] = useState<string | null>('basics')
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const addCustomSection = useResumeEditorStore((s) => s.addCustomSection)
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)
  const removeCustomSection = useResumeEditorStore((s) => s.removeCustomSection)

  const orderedSections = (meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : ['work', 'education', 'skills', 'volunteer', 'languages']
  ).filter((s) => s in SECTION_FORMS || s.startsWith('custom:'))

  const sectionOrder = ['basics', ...orderedSections]

  function moveSection(metaIdx: number, direction: 'up' | 'down') {
    const current = useResumeEditorStore.getState().meta.sectionOrder
    const order = [...current]
    const swapIdx = direction === 'up' ? metaIdx - 1 : metaIdx + 1
    ;[order[metaIdx], order[swapIdx]] = [order[swapIdx], order[metaIdx]]
    setMeta({ sectionOrder: order })
  }

  function handleAddSection() {
    const newSection: CustomSection = {
      id: crypto.randomUUID(),
      name: 'New Section',
      enabledFields: ['summary'],
      items: [],
    }
    addCustomSection(newSection)
    setOpenSection(`custom:${newSection.id}`)
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-2 bg-transparent">
      {sectionOrder.map((section, idx) => {
        const metaIdx = idx - 1
        const isBasics = section === 'basics'
        const isCustom = section.startsWith('custom:')

        if (isCustom) {
          const customId = section.slice(7)
          const customSection = data.customSections?.find((cs) => cs.id === customId)
          if (!customSection) return null
          return (
            <AccordionSection
              key={section}
              title={customSection.name}
              badge={getCustomBadge(customSection)}
              isOpen={openSection === section}
              onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
              onMoveUp={metaIdx > 0 ? () => moveSection(metaIdx, 'up') : undefined}
              onMoveDown={metaIdx < orderedSections.length - 1 ? () => moveSection(metaIdx, 'down') : undefined}
              onRename={(name) => updateCustomSection(customId, { name })}
              onDelete={() => removeCustomSection(customId)}
            >
              <CustomSectionForm sectionId={customId} />
            </AccordionSection>
          )
        }

        const FormComponent = SECTION_FORMS[section]
        if (!FormComponent) return null
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

      <button
        type="button"
        onClick={handleAddSection}
        className="w-full mt-2 py-2.5 border-2 border-dashed border-indigo-200 rounded-xl text-sm text-indigo-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors font-medium"
      >
        + Add Section
      </button>
    </div>
  )
}
