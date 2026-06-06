'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['publications']>[number]
const createEmpty = (): Item => ({ name: '', publisher: '', releaseDate: '', url: '', summary: '' })
const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Publication title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove publication"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.publisher ?? ''} onChange={(e) => set('publisher', e.target.value)}
          placeholder="Publisher" className={inputClass} />
        <input type="text" value={item.releaseDate ?? ''} onChange={(e) => set('releaseDate', e.target.value)}
          placeholder="Release date (2023-01)" className={inputClass} />
      </div>
      <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
        placeholder="URL" className={inputClass} />
      <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
        placeholder="Abstract / Summary..." rows={2}
        className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
    </div>
  )
}

export function PublicationsForm() {
  const items = useResumeEditorStore((s) => s.data.publications ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('publications', v)}
      createEmpty={createEmpty} addLabel="Add publication"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
