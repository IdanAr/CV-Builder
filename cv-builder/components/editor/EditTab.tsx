'use client'

import { useState, useEffect, useRef } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useShallow } from 'zustand/react/shallow'
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

// Flat, primitive-valued records so a useShallow-wrapped selector can
// correctly skip a re-render when nothing here actually changed — a nested
// object/array would get a fresh identity on every call even with identical
// content, defeating useShallow's one-level equality check.
export function computeSectionBadges(data: ResumeData): Record<string, string> {
  const badges: Record<string, string> = {}
  for (const key of Object.keys(SECTION_LABELS)) {
    badges[key] = getBadge(key, data)
  }
  return badges
}

export function computeCustomSectionNames(data: ResumeData): Record<string, string> {
  return Object.fromEntries((data.customSections ?? []).map((cs) => [cs.id, cs.name]))
}

export function computeCustomSectionBadges(data: ResumeData): Record<string, string> {
  return Object.fromEntries((data.customSections ?? []).map((cs) => [cs.id, getCustomBadge(cs)]))
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
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const meta = useResumeEditorStore((s) => s.meta)
  const sectionBadges = useResumeEditorStore(useShallow((s) => computeSectionBadges(s.data)))
  const customSectionNames = useResumeEditorStore(useShallow((s) => computeCustomSectionNames(s.data)))
  const customSectionBadges = useResumeEditorStore(useShallow((s) => computeCustomSectionBadges(s.data)))
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const addCustomSection = useResumeEditorStore((s) => s.addCustomSection)
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)
  const removeCustomSection = useResumeEditorStore((s) => s.removeCustomSection)
  const removeBuiltInSection = useResumeEditorStore((s) => s.removeBuiltInSection)
  const undo = useResumeEditorStore((s) => s.undo)
  const redo = useResumeEditorStore((s) => s.redo)
  const pendingFocus = useResumeEditorStore((s) => s.pendingFocus)
  const pendingFocusEntryIndex = useResumeEditorStore((s) => s.pendingFocusEntryIndex)
  const clearFocus = useResumeEditorStore((s) => s.clearFocus)
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

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

  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setAddMenuOpen(false)
    }
    window.addEventListener('keydown', onEsc)
    return () => window.removeEventListener('keydown', onEsc)
  }, [])

  useEffect(() => {
    if (!pendingFocus) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenSection(pendingFocus)
    // Wait a frame so the accordion has expanded before scrolling to it.
    requestAnimationFrame(() => {
      sectionRefs.current[pendingFocus]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    // A specific entry within the section was requested (e.g. a new entry
    // added from the Preview) — leave pendingFocus set. ListFieldManager only
    // mounts once this accordion is actually open (a later render than this
    // effect), so it's the one that scrolls to the exact entry and clears
    // focus once that's done. Otherwise (no entry target, e.g. re-adding a
    // removed section) there's nothing further to do — clear here.
    if (pendingFocusEntryIndex === null) clearFocus()
  }, [pendingFocus, pendingFocusEntryIndex, clearFocus])

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

  const removedBuiltIns = Object.keys(SECTION_LABELS).filter((k) => k !== 'basics' && !orderedSections.includes(k))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const oldIndex = orderedSections.indexOf(String(active.id))
    const newIndex = orderedSections.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    setMeta({ sectionOrder: arrayMove(orderedSections, oldIndex, newIndex) })
  }

  function handleDeleteBuiltIn(section: string) {
    const arr = (useResumeEditorStore.getState().data as Record<string, unknown[]>)[section]
    const count = Array.isArray(arr) ? arr.length : 0
    if (count > 0) {
      const label = SECTION_LABELS[section] ?? section
      if (!window.confirm(`Delete ${label} and its ${count} ${count === 1 ? 'entry' : 'entries'}? This can't be undone.`)) {
        return
      }
    }
    removeBuiltInSection(section as Parameters<typeof removeBuiltInSection>[0])
    if (openSection === section) setOpenSection(null)
  }

  /**
   * Custom sections previously deleted straight through with no confirmation
   * while built-in ones prompted — so the section type silently decided whether
   * a misclick cost you the content, with nothing on screen signalling the
   * difference. Same content-aware gate as handleDeleteBuiltIn: silent for an
   * empty section, confirmed once it holds entries.
   */
  function handleDeleteCustom(customId: string, sectionKey: string, name: string) {
    const custom = (useResumeEditorStore.getState().data.customSections ?? []).find((cs) => cs.id === customId)
    const count = custom?.items.length ?? 0
    if (count > 0) {
      if (!window.confirm(`Delete ${name} and its ${count} ${count === 1 ? 'entry' : 'entries'}? This can't be undone.`)) {
        return
      }
    }
    removeCustomSection(customId)
    if (openSection === sectionKey) setOpenSection(null)
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
    setAddMenuOpen(false)
  }

  function handleReAddSection(section: string) {
    setMeta({ sectionOrder: [...orderedSections, section] })
    setOpenSection(section)
    setAddMenuOpen(false)
  }

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-2 bg-transparent">
      {/* basics is always first and not sortable */}
      <AccordionSection
        title={SECTION_LABELS['basics']}
        badge={sectionBadges['basics']}
        isOpen={openSection === 'basics'}
        onToggle={() => setOpenSection((prev) => (prev === 'basics' ? null : 'basics'))}
        icon={<SectionIcon section="basics" />}
      >
        <BasicsForm />
      </AccordionSection>

      <div className="relative">
        <button
          type="button"
          onClick={() => setAddMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={addMenuOpen}
          className="w-full py-2.5 border-2 border-dashed border-indigo-300 rounded-xl text-sm font-semibold text-indigo-500 bg-indigo-50/50 shadow-[0_0_14px_-2px_rgba(99,102,241,0.45)] hover:border-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 hover:shadow-[0_0_20px_-2px_rgba(99,102,241,0.6)] transition-all"
        >
          + Add Section
        </button>
        {addMenuOpen && (
          <>
            <div className="fixed inset-0 z-10" aria-hidden="true" onClick={() => setAddMenuOpen(false)} />
            <div
              role="menu"
              className="absolute left-0 right-0 mt-1 z-20 rounded-xl border border-indigo-100 bg-white shadow-lg overflow-hidden"
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleAddSection}
                title="Custom sections hold content the built-in categories don't cover. Give it a name, pick which fields to show, and add as many entries as you like. Handy for things like Military Service, References, or Conferences."
                className="w-full text-left px-4 py-2.5 text-sm text-indigo-900 hover:bg-indigo-50"
              >
                + New custom section
              </button>
              {removedBuiltIns.length > 0 && (
                <div className="border-t border-indigo-50">
                  <p className="px-4 pt-2 pb-1 text-[11px] uppercase tracking-wide text-indigo-300">Add built-in sections</p>
                  {removedBuiltIns.map((section) => (
                    <button
                      key={section}
                      type="button"
                      role="menuitem"
                      onClick={() => handleReAddSection(section)}
                      className="w-full flex items-center gap-2 text-left px-4 py-2 text-sm text-indigo-800 hover:bg-indigo-50"
                    >
                      <SectionIcon section={section} />
                      {SECTION_LABELS[section]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Explicit id makes dnd-kit's auto-generated aria ids (DndDescribedBy-N)
          deterministic across server and client — without it dnd-kit derives
          the suffix from an internal render-order counter, which starts from
          a different count on a fresh SSR pass than on the client's first
          hydration render, producing a hydration mismatch. */}
      <DndContext id="edit-tab-sections" collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
          {orderedSections.map((section) => {
            if (section.startsWith('custom:')) {
              const customId = section.slice(7)
              const customName = customSectionNames[customId]
              if (customName === undefined) return null
              return (
                <div key={section} ref={(el) => { sectionRefs.current[section] = el }}>
                  <SortableAccordionItem id={section}>
                    {(dragHandleProps) => (
                      <AccordionSection
                        title={customName}
                        badge={customSectionBadges[customId]}
                        isOpen={openSection === section}
                        onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
                        onRename={(name) => updateCustomSection(customId, { name })}
                        onDelete={() => handleDeleteCustom(customId, section, customName)}
                        dragHandleProps={dragHandleProps}
                        icon={<SectionIcon section="custom" />}
                      >
                        <CustomSectionForm sectionId={customId} />
                      </AccordionSection>
                    )}
                  </SortableAccordionItem>
                </div>
              )
            }
            const FormComponent = SECTION_FORMS[section]
            if (!FormComponent) return null
            return (
              <div key={section} ref={(el) => { sectionRefs.current[section] = el }}>
                <SortableAccordionItem id={section}>
                  {(dragHandleProps) => (
                    <AccordionSection
                      title={SECTION_LABELS[section] ?? section}
                      badge={sectionBadges[section]}
                      isOpen={openSection === section}
                      onToggle={() => setOpenSection((prev) => (prev === section ? null : section))}
                      onDelete={() => handleDeleteBuiltIn(section)}
                      dragHandleProps={dragHandleProps}
                      icon={<SectionIcon section={section} />}
                    >
                      <FormComponent />
                    </AccordionSection>
                  )}
                </SortableAccordionItem>
              </div>
            )
          })}
        </SortableContext>
      </DndContext>
    </div>
  )
}
