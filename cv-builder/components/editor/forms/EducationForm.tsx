'use client'

import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { DateRangeFields } from './DateRangeFields'
import { inputClass } from './field-styles'
import { createEmptyEducation as createEmpty, createEmptyEducationRole } from '@/lib/schemas/resume-empty-entries'
import { resolveEducationRoles } from '@/lib/roles'
import type { ResumeData, EducationRole } from '@/lib/schemas/resume.zod'
import { X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

type EduItem = NonNullable<ResumeData['education']>[number]

const EMPTY_EDUCATION: EduItem[] = []

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
          className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-1 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </div>
      <DateRangeFields
        startValue={role.startDate ?? ''}
        endValue={role.endDate ?? ''}
        onStartChange={(v) => set('startDate', v)}
        onEndChange={(v) => set('endDate', v)}
      />
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
  const roles = resolveEducationRoles(item)
  const setRoles = (roles: EducationRole[]) => onUpdate({
    ...item, roles,
    studyType: undefined, area: undefined, startDate: undefined, endDate: undefined, score: undefined, courses: undefined,
  })
  const addRoleLabel = item.institution ? `Add another program at ${item.institution}` : 'Add another program'

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <label htmlFor={`${id}-institution`} className="sr-only">University / School</label>
        <input id={`${id}-institution`} type="text" value={item.institution ?? ''} onChange={(e) => set('institution', e.target.value)}
          placeholder="University / School" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove education entry"
          className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-1 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </div>
      <div className="pl-3 border-l-2 border-indigo-100">
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
