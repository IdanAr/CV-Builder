'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { inputClass } from './field-styles'
import { createEmptyVolunteer as createEmpty } from '@/lib/schemas/resume-empty-entries'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['volunteer']>[number]
const EMPTY_VOLUNTEER: Item[] = []

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const id = useId()
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  const setHighlights = (highlights: string[]) => onUpdate({ ...item, highlights })
  const addH = () => setHighlights([...(item.highlights ?? []), ''])
  const updateH = (i: number, v: string) =>
    setHighlights((item.highlights ?? []).map((h, idx) => (idx === i ? v : h)))
  const removeH = (i: number) =>
    setHighlights((item.highlights ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <label htmlFor={`${id}-organization`} className="sr-only">Organization</label>
          <input id={`${id}-organization`} type="text" value={item.organization ?? ''} onChange={(e) => set('organization', e.target.value)}
            placeholder="Organization" className={inputClass} />
          <label htmlFor={`${id}-position`} className="sr-only">Role</label>
          <input id={`${id}-position`} type="text" value={item.position ?? ''} onChange={(e) => set('position', e.target.value)}
            placeholder="Role" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove volunteer entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={item.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
        <MonthYearPicker value={item.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
      </div>
      <label htmlFor={`${id}-summary`} className="sr-only">Summary</label>
      <RichTextField
        id={`${id}-summary`}
        value={item.summary ?? ''}
        onChange={(v) => set('summary', v)}
        placeholder="Summary..."
      />
      <fieldset className="space-y-1 border-0 p-0 m-0">
        <legend className="block text-xs font-medium text-indigo-600 p-0">Highlights</legend>
        {(item.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1 items-start">
            <RichTextField
              value={h}
              onChange={(v) => updateH(i, v)}
              placeholder="Achievement..."
              ariaLabel={`Highlight ${i + 1}`}
              className="flex-1"
              height={120}
            />
            <button type="button" onClick={() => removeH(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1 mt-6">✕</button>
          </div>
        ))}
        <button type="button" onClick={addH} className="text-xs text-indigo-600 hover:text-indigo-800">
          + Add highlight
        </button>
      </fieldset>
    </div>
  )
}

export function VolunteerForm() {
  const items = useResumeEditorStore((s) => s.data.volunteer ?? EMPTY_VOLUNTEER)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> sectionKey="volunteer" items={items} onChange={(v) => setSectionData('volunteer', v)}
      createEmpty={createEmpty} addLabel="Add volunteer experience"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
