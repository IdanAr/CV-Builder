'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { inputClass as sharedInputClass } from './field-styles'
import { createEmptyLanguage as createEmpty } from '@/lib/schemas/resume-empty-entries'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['languages']>[number]
const EMPTY_LANGUAGES: Item[] = []
const inputClass = `${sharedInputClass} appearance-none`

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const id = useId()
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="flex gap-2 items-center">
      <label htmlFor={`${id}-language`} className="sr-only">Language</label>
      <input id={`${id}-language`} type="text" value={item.language ?? ''} onChange={(e) => set('language', e.target.value)}
        placeholder="Language" className={`${inputClass} flex-1`} />
      <label htmlFor={`${id}-fluency`} className="sr-only">Fluency</label>
      <select id={`${id}-fluency`} value={item.fluency ?? ''} onChange={(e) => set('fluency', e.target.value)}
        className={`${inputClass} flex-1`}>
        <option value="">Select fluency…</option>
        <option value="Native">Native</option>
        <option value="Fluent">Fluent</option>
        <option value="Advanced">Advanced</option>
        <option value="Intermediate">Intermediate</option>
        <option value="Elementary">Elementary</option>
        <option value="Conversational">Conversational</option>
      </select>
      <button type="button" onClick={onRemove} aria-label="Remove language"
        className="text-gray-400 hover:text-red-500 text-sm">✕</button>
    </div>
  )
}

export function LanguagesForm() {
  const items = useResumeEditorStore((s) => s.data.languages ?? EMPTY_LANGUAGES)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('languages', v)}
      createEmpty={createEmpty} addLabel="Add language"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
