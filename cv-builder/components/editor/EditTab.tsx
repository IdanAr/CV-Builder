'use client'

import { useState, useEffect } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { AccordionSection, type DragHandleProps } from './AccordionSection'
import { SectionIcon } from '@/components/ui/SectionIcon'
import { BasicsForm } from './forms/BasicsForm'
import { WorkForm } from './forms/WorkForm'
import { EducationForm } from './forms/EducationForm'
import { SkillsForm } from './forms/SkillsForm'
import { LanguagesForm } from './forms/LanguagesForm'
import { VolunteerForm } from './forms/VolunteerForm'
import { CustomSectionForm } from './forms/CustomSectionForm'
import { CertificatesForm } from './forms/CertificatesForm'
import { AwardsForm } from './forms/AwardsForm'
import { PublicationsForm } from './forms/PublicationsForm'
import { InterestsForm } from './forms/InterestsForm'
import { ProjectsForm } from './forms/ProjectsForm'
import type { ResumeData, CustomSection } from '@/lib/schemas/resume.zod'

const SECTION_LABELS: Record<string, string> = {
  basics: 'Personal Info',
  work: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  volunteer: 'Volunteer',
  certificates: 'Certificates',
  awards: 'Awards',
  publications: 'Publications',
  interests: 'Interests',
  projects: 'Projects',
}

const SECTION_FORMS: Record<string, React.ComponentType> = {
  basics: BasicsForm,
  work: WorkForm,
  education: EducationForm,
  skills: SkillsForm,
  languages: LanguagesForm,
  volunteer: VolunteerForm,
  certificates: CertificatesForm,
  awards: AwardsForm,
  publications: PublicationsForm,
  interests: InterestsForm,
  projects: ProjectsForm,
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

function SortableAccordionItem({
  id,
  children,
}: {
  id: string
  children: (props: DragHandleProps) => React.ReactNode
}) {
  const { listeners, attributes, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return <>{children({ listeners, attributes, setNodeRef, transform, transition, isDragging })}</>
}

export function EditTab() {
  const [openSection, setOpenSection] = useState<string | null>('basics')
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const addCustomSection = useResumeEditorStore((s) => s.addCustomSection)
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)
  const removeCustomSection = useResumeEditorStore((s) => s.removeCustomSection)
  const undo = useResumeEditorStore((s) => s.undo)
  const redo = useResumeEditorStore((s) => s.redo)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if (mod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo])

  const orderedSections = (meta.sectionOrder?.length > 0
    ? meta.sectionOrder
    : [
        'work',
        'education',
        'skills',
        'certificates',
        'awards',
        'publications',
        'volunteer',
        'languages',
        'interests',
        'projects',
      ]
  ).filter((s) => (s in SECTION_FORMS && s !== 'basics') || s.startsWith('custom:'))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const oldIndex = orderedSections.indexOf(String(active.id))
    const newIndex = orderedSections.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setMeta({ sectionOrder: arrayMove(orderedSections, oldIndex, newIndex) })
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
      {/* basics is always first and not sortable */}
      <AccordionSection
        title={SECTION_LABELS['basics']}
        badge={getBadge('basics', data)}
        isOpen={openSection === 'basics'}
        onToggle={() => setOpenSection((prev) => (prev === 'basics' ? null : 'basics'))}
        icon={<SectionIcon section="basics" />}
      >
        <BasicsForm />
      </AccordionSection>

      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
          {orderedSections.map((section) => {
            if (section.startsWith('custom:')) {
              const customId = section.slice(7)
              const customSection = data.customSections?.find((cs) => cs.id === customId)
              if (!customSection) return null
              return (
                <SortableAccordionItem key={section} id={section}>
                  {(dragHandleProps) => (
                    <AccordionSection
                      title={customSection.name}
                      badge={getCustomBadge(customSection)}
                      isOpen={openSection === section}
                      onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
                      onRename={(name) => updateCustomSection(customId, { name })}
                      onDelete={() => removeCustomSection(customId)}
                      dragHandleProps={dragHandleProps}
                      icon={<SectionIcon section="custom" />}
                    >
                      <CustomSectionForm sectionId={customId} />
                    </AccordionSection>
                  )}
                </SortableAccordionItem>
              )
            }
            const FormComponent = SECTION_FORMS[section]
            if (!FormComponent) return null
            return (
              <SortableAccordionItem key={section} id={section}>
                {(dragHandleProps) => (
                  <AccordionSection
                    title={SECTION_LABELS[section] ?? section}
                    badge={getBadge(section, data)}
                    isOpen={openSection === section}
                    onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
                    dragHandleProps={dragHandleProps}
                    icon={<SectionIcon section={section} />}
                  >
                    <FormComponent />
                  </AccordionSection>
                )}
              </SortableAccordionItem>
            )
          })}
        </SortableContext>
      </DndContext>

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
