'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['awards']>[number]
const createEmpty = (): Item => ({ title: '', date: '', awarder: '', summary: '' })
const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.title ?? ''} onChange={(e) => set('title', e.target.value)}
          placeholder="Award title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove award"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.awarder ?? ''} onChange={(e) => set('awarder', e.target.value)}
          placeholder="Awarded by" className={inputClass} />
        <input type="text" value={item.date ?? ''} onChange={(e) => set('date', e.target.value)}
          placeholder="Date (2023-06)" className={inputClass} />
      </div>
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Description..." rows={2}
        className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
    </div>
  )
}

export function AwardsForm() {
  const items = useResumeEditorStore((s) => s.data.awards ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('awards', v)}
      createEmpty={createEmpty} addLabel="Add award"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
