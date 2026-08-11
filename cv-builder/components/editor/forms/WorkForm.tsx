// components/editor/forms/WorkForm.tsx
'use client'

import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { inputClass } from './field-styles'
import { createEmptyWork as createEmpty, createEmptyWorkRole } from '@/lib/schemas/resume-empty-entries'
import { resolveWorkRoles } from '@/lib/roles'
import type { ResumeData, WorkRole } from '@/lib/schemas/resume.zod'

type WorkItem = NonNullable<ResumeData['work']>[number]

const EMPTY_WORK: WorkItem[] = []

function RoleForm({
  role, company, resumeId, onUpdate, onRemove,
}: {
  role: WorkRole
  company: string
  resumeId: string
  onUpdate: (v: WorkRole) => void
  onRemove: () => void
}) {
  const id = useId()
  const set = (field: keyof WorkRole, value: string) => onUpdate({ ...role, [field]: value })
  const setHighlights = (highlights: string[]) => onUpdate({ ...role, highlights })
  const addHighlight = () => setHighlights([...(role.highlights ?? []), ''])
  const updateHighlight = (i: number, v: string) =>
    setHighlights((role.highlights ?? []).map((h, idx) => (idx === i ? v : h)))
  const removeHighlight = (i: number) =>
    setHighlights((role.highlights ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <label htmlFor={`${id}-position`} className="sr-only">Job title</label>
        <input id={`${id}-position`} type="text" value={role.position ?? ''} onChange={(e) => set('position', e.target.value)}
          placeholder="Job title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove role"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={role.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
        <MonthYearPicker value={role.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
      </div>
      <label htmlFor={`${id}-summary`} className="sr-only">Role summary</label>
      <RichTextField
        id={`${id}-summary`}
        value={role.summary ?? ''}
        onChange={(v) => set('summary', v)}
        placeholder="Role summary..."
      />
      <fieldset className="space-y-1 border-0 p-0 m-0">
        <legend className="block text-xs font-medium text-indigo-600 p-0">Bullet points</legend>
        {(role.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1 items-start">
            <RichTextField
              value={h}
              onChange={(v) => updateHighlight(i, v)}
              placeholder="Achieved X by doing Y, resulting in Z"
              ariaLabel={`Bullet point ${i + 1}`}
              className="flex-1"
              height={120}
            />
            <AiSuggestButton
              resumeId={resumeId}
              currentValue={h}
              context={{ jobTitle: role.position, company, field: 'highlight' }}
              onAccept={(v) => updateHighlight(i, v)}
            />
            <button type="button" onClick={() => removeHighlight(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1 mt-6">✕</button>
          </div>
        ))}
        <button type="button" onClick={addHighlight}
          className="text-xs text-indigo-600 hover:text-indigo-800">+ Add bullet</button>
      </fieldset>
    </div>
  )
}

function WorkItemForm({
  item, resumeId, onUpdate, onRemove,
}: {
  item: WorkItem
  resumeId: string
  onUpdate: (v: WorkItem) => void
  onRemove: () => void
}) {
  const id = useId()
  const set = (field: keyof WorkItem, value: string) => onUpdate({ ...item, [field]: value })

  const roles = resolveWorkRoles(item)
  const setRoles = (roles: WorkRole[]) => onUpdate({
    ...item, roles,
    // roles[] is the sole source of truth once edited through this list —
    // clear the legacy flat fields so they don't linger as stale shadow
    // data (same pattern BasicsForm uses for legacy basics.url).
    position: undefined, startDate: undefined, endDate: undefined, summary: undefined, highlights: undefined,
  })
  const addRoleLabel = item.name ? `Add another role at ${item.name}` : 'Add another role'

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <label htmlFor={`${id}-name`} className="sr-only">Company name</label>
        <input id={`${id}-name`} type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Company name" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove work entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="pl-3 border-l-2 border-indigo-100">
        <ListFieldManager<WorkRole>
          items={roles}
          onChange={setRoles}
          createEmpty={createEmptyWorkRole}
          addLabel={addRoleLabel}
          renderItem={(role, _, onUpdateRole, onRemoveRole) => (
            <RoleForm role={role} company={item.name ?? ''} resumeId={resumeId} onUpdate={onUpdateRole} onRemove={onRemoveRole} />
          )}
        />
      </div>
    </div>
  )
}

export function WorkForm() {
  const work = useResumeEditorStore((s) => s.data.work ?? EMPTY_WORK)
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<WorkItem>
      sectionKey="work"
      items={work}
      onChange={(items) => setSectionData('work', items)}
      createEmpty={createEmpty}
      addLabel="Add work experience"
      renderItem={(item, _, onUpdate, onRemove) => (
        <WorkItemForm item={item} resumeId={resumeId} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    />
  )
}
