'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['interests']>[number]
const createEmpty = (): Item => ({ name: '', keywords: [] })
const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const setKeywords = (keywords: string[]) => onUpdate({ ...item, keywords })
  const addKw = () => setKeywords([...(item.keywords ?? []), ''])
  const updateKw = (i: number, v: string) =>
    setKeywords((item.keywords ?? []).map((k, idx) => (idx === i ? v : k)))
  const removeKw = (i: number) =>
    setKeywords((item.keywords ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => onUpdate({ ...item, name: e.target.value })}
          placeholder="Interest (e.g. Open Source)" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove interest"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      {(item.keywords ?? []).map((k, i) => (
        <div key={i} className="flex gap-1">
          <input type="text" value={k} onChange={(e) => updateKw(i, e.target.value)}
            placeholder="keyword" className={`${inputClass} flex-1`} />
          <button type="button" onClick={() => removeKw(i)} aria-label="Remove keyword"
            className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={addKw} className="text-xs text-indigo-600 hover:text-indigo-800">
        + Add keyword
      </button>
    </div>
  )
}

export function InterestsForm() {
  const items = useResumeEditorStore((s) => s.data.interests ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('interests', v)}
      createEmpty={createEmpty} addLabel="Add interest"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
