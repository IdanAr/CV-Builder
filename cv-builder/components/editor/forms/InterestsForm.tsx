'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { inputClass } from './field-styles'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['interests']>[number]
const EMPTY_ITEMS: Item[] = []
const createEmpty = (): Item => ({ name: '', keywords: [] })

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const id = useId()
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  const setKeywords = (keywords: string[]) => onUpdate({ ...item, keywords })
  const addKeyword = () => setKeywords([...(item.keywords ?? []), ''])
  const updateKeyword = (i: number, v: string) =>
    setKeywords((item.keywords ?? []).map((k, idx) => (idx === i ? v : k)))
  const removeKeyword = (i: number) =>
    setKeywords((item.keywords ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <label htmlFor={`${id}-name`} className="sr-only">Interest name</label>
        <input id={`${id}-name`} type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Interest name" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove interest entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <fieldset className="space-y-1 border-0 p-0 m-0">
        <legend className="block text-xs font-medium text-indigo-600 p-0">Keywords</legend>
        {(item.keywords ?? []).map((k, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={k} onChange={(e) => updateKeyword(i, e.target.value)}
              placeholder="e.g. Trail running" aria-label={`Keyword ${i + 1}`} className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => removeKeyword(i)} aria-label="Remove keyword"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addKeyword}
          className="text-xs text-indigo-600 hover:text-indigo-800">+ Add keyword</button>
      </fieldset>
    </div>
  )
}

export function InterestsForm() {
  const items = useResumeEditorStore((s) => s.data.interests ?? EMPTY_ITEMS)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('interests', v)}
      createEmpty={createEmpty} addLabel="Add interest"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
