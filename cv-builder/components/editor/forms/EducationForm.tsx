'use client'

import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { MonthYearPicker } from './MonthYearPicker'
import { inputClass } from './field-styles'
import { createEmptyEducation as createEmpty, createEmptyEducationRole } from '@/lib/schemas/resume-empty-entries'
import type { ResumeData, EducationRole } from '@/lib/schemas/resume.zod'

type EduItem = NonNullable<ResumeData['education']>[number]

const EMPTY_EDUCATION: EduItem[] = []
const EMPTY_ROLES: EducationRole[] = []

function RoleForm({ role, onUpdate, onRemove }: { role: EducationRole; onUpdate: (v: EducationRole) => void; onRemove: () => void }) {
  const id = useId()
  const set = (field: keyof EducationRole, value: string) => onUpdate({ ...role, [field as keyof EducationRole]: value as never })
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <label htmlFor={`${id}-studyType`} className="sr-only">Degree</label>
          <input id={`${id}-studyType`} type="text" value={role.studyType ?? ''} onChange={(e) => set('studyType', e.target.value)}
            placeholder="Degree (B.Sc.)" className={inputClass} />
          <label htmlFor={`${id}-area`} className="sr-only">Field of study</label>
          <input id={`${id}-area`} type="text" value={role.area ?? ''} onChange={(e) => set('area', e.target.value)}
            placeholder="Field of study" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove role"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={role.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
        <MonthYearPicker value={role.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
      </div>
      <div>
        <label htmlFor={`${id}-score`} className="sr-only">GPA / Score</label>
        <input id={`${id}-score`} type="text" value={role.score ?? ''} onChange={(e) => set('score', e.target.value)}
          placeholder="GPA / Score" className={inputClass} />
      </div>
    </div>
  )
}

function EduItemForm({ item, onUpdate, onRemove }: { item: EduItem; onUpdate: (v: EduItem) => void; onRemove: () => void }) {
  const id = useId()
  const set = (field: keyof EduItem, value: string) => onUpdate({ ...item, [field as keyof EduItem]: value as never })
  const roles = item.roles ?? EMPTY_ROLES
  const setRoles = (roles: EducationRole[]) => onUpdate({ ...item, roles })
  const addRoleLabel = item.institution ? `Add another program at ${item.institution}` : 'Add another program'

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <label htmlFor={`${id}-institution`} className="sr-only">University / School</label>
        <input id={`${id}-institution`} type="text" value={item.institution ?? ''} onChange={(e) => set('institution', e.target.value)}
          placeholder="University / School" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove education entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label htmlFor={`${id}-studyType`} className="sr-only">Degree</label>
        <input id={`${id}-studyType`} type="text" value={item.studyType ?? ''} onChange={(e) => set('studyType', e.target.value)}
          placeholder="Degree (B.Sc.)" className={inputClass} />
        <label htmlFor={`${id}-area`} className="sr-only">Field of study</label>
        <input id={`${id}-area`} type="text" value={item.area ?? ''} onChange={(e) => set('area', e.target.value)}
          placeholder="Field of study" className={inputClass} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={item.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
        <MonthYearPicker value={item.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
      </div>
      <div>
        <label htmlFor={`${id}-score`} className="sr-only">GPA / Score</label>
        <input id={`${id}-score`} type="text" value={item.score ?? ''} onChange={(e) => set('score', e.target.value)}
          placeholder="GPA / Score" className={inputClass} />
      </div>
      <div className="pl-3 border-l-2 border-indigo-100 space-y-2">
        <ListFieldManager<EducationRole>
          items={roles}
          onChange={setRoles}
          createEmpty={createEmptyEducationRole}
          addLabel={addRoleLabel}
          renderItem={(role, _, onUpdateRole, onRemoveRole) => (
            <RoleForm role={role} onUpdate={onUpdateRole} onRemove={onRemoveRole} />
          )}
        />
      </div>
    </div>
  )
}

export function EducationForm() {
  const education = useResumeEditorStore((s) => s.data.education ?? EMPTY_EDUCATION)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<EduItem>
      sectionKey="education"
      items={education}
      onChange={(items) => setSectionData('education', items)}
      createEmpty={createEmpty}
      addLabel="Add education"
      renderItem={(item, _, onUpdate, onRemove) => (
        <EduItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    />
  )
}
