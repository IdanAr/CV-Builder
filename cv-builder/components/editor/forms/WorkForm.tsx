// components/editor/forms/WorkForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type WorkItem = NonNullable<ResumeData['work']>[number]

const EMPTY_WORK: WorkItem[] = []

const createEmpty = (): WorkItem => ({
  name: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
})

const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function WorkItemForm({
  item,
  resumeId,
  onUpdate,
  onRemove,
}: {
  item: WorkItem
  resumeId: string
  onUpdate: (v: WorkItem) => void
  onRemove: () => void
}) {
  const set = (field: keyof WorkItem, value: string) => onUpdate({ ...item, [field]: value })

  const setHighlights = (highlights: string[]) => onUpdate({ ...item, highlights })
  const addHighlight = () => setHighlights([...(item.highlights ?? []), ''])
  const updateHighlight = (i: number, v: string) =>
    setHighlights((item.highlights ?? []).map((h, idx) => (idx === i ? v : h)))
  const removeHighlight = (i: number) =>
    setHighlights((item.highlights ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Company name" className={inputClass} />
          <input type="text" value={item.position ?? ''} onChange={(e) => set('position', e.target.value)}
            placeholder="Job title" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove work entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start date (2020-01)" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End date or Present" className={inputClass} />
      </div>
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Role summary..." rows={2}
        className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-indigo-600">Bullet points</label>
        {(item.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1 items-center">
            <input type="text" value={h} onChange={(e) => updateHighlight(i, e.target.value)}
              placeholder="Achieved X by doing Y, resulting in Z" className={`${inputClass} flex-1`} />
            <AiSuggestButton
              resumeId={resumeId}
              currentValue={h}
              context={{ jobTitle: item.position, company: item.name, field: 'highlight' }}
              onAccept={(v) => updateHighlight(i, v)}
            />
            <button type="button" onClick={() => removeHighlight(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addHighlight}
          className="text-xs text-indigo-600 hover:text-indigo-800">+ Add bullet</button>
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
