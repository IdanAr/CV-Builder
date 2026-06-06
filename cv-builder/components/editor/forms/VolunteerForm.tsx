'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['volunteer']>[number]
const createEmpty = (): Item => ({
  organization: '', position: '', url: '', startDate: '', endDate: '', summary: '', highlights: [],
})
const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
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
          <input type="text" value={item.organization ?? ''} onChange={(e) => set('organization', e.target.value)}
            placeholder="Organization" className={inputClass} />
          <input type="text" value={item.position ?? ''} onChange={(e) => set('position', e.target.value)}
            placeholder="Role" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove volunteer entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start date" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End date" className={inputClass} />
      </div>
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Summary..." rows={2}
        className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-indigo-600">Highlights</label>
        {(item.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={h} onChange={(e) => updateH(i, e.target.value)}
              placeholder="Achievement..." className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => removeH(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addH} className="text-xs text-indigo-600 hover:text-indigo-800">
          + Add highlight
        </button>
      </div>
    </div>
  )
}

export function VolunteerForm() {
  const items = useResumeEditorStore((s) => s.data.volunteer ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('volunteer', v)}
      createEmpty={createEmpty} addLabel="Add volunteer experience"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
