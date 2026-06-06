'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['languages']>[number]
const createEmpty = (): Item => ({ language: '', fluency: '' })
const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="flex gap-2 items-center">
      <input type="text" value={item.language ?? ''} onChange={(e) => set('language', e.target.value)}
        placeholder="Language" className={`${inputClass} flex-1`} />
      <input type="text" value={item.fluency ?? ''} onChange={(e) => set('fluency', e.target.value)}
        placeholder="Fluency (Native)" className={`${inputClass} flex-1`} />
      <button type="button" onClick={onRemove} aria-label="Remove language"
        className="text-gray-400 hover:text-red-500 text-sm">✕</button>
    </div>
  )
}

export function LanguagesForm() {
  const items = useResumeEditorStore((s) => s.data.languages ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('languages', v)}
      createEmpty={createEmpty} addLabel="Add language"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
