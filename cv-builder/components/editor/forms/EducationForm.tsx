'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type EduItem = NonNullable<ResumeData['education']>[number]

const EMPTY_EDUCATION: EduItem[] = []

const createEmpty = (): EduItem => ({
  institution: '', url: '', area: '', studyType: '', startDate: '', endDate: '', score: '', courses: [],
})

const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function EduItemForm({ item, onUpdate, onRemove }: { item: EduItem; onUpdate: (v: EduItem) => void; onRemove: () => void }) {
  const set = (field: keyof EduItem, value: string) => onUpdate({ ...item, [field as keyof EduItem]: value as never })
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <input type="text" value={item.institution ?? ''} onChange={(e) => set('institution', e.target.value)}
          placeholder="University / School" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove education entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.studyType ?? ''} onChange={(e) => set('studyType', e.target.value)}
          placeholder="Degree (B.Sc.)" className={inputClass} />
        <input type="text" value={item.area ?? ''} onChange={(e) => set('area', e.target.value)}
          placeholder="Field of study" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start (2018-09)" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End (2022-06)" className={inputClass} />
        <input type="text" value={item.score ?? ''} onChange={(e) => set('score', e.target.value)}
          placeholder="GPA / Score" className={inputClass} />
      </div>
    </div>
  )
}

export function EducationForm() {
  const education = useResumeEditorStore((s) => s.data.education ?? EMPTY_EDUCATION)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<EduItem>
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
