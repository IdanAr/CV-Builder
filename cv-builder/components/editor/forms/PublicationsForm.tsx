'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { inputClass } from './field-styles'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['publications']>[number]
const EMPTY_ITEMS: Item[] = []
const createEmpty = (): Item => ({
  name: '', publisher: '', releaseDate: '', url: '', summary: '',
})

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const id = useId()
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <label htmlFor={`${id}-name`} className="sr-only">Publication name</label>
          <input id={`${id}-name`} type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Publication name" className={inputClass} />
          <label htmlFor={`${id}-publisher`} className="sr-only">Publisher</label>
          <input id={`${id}-publisher`} type="text" value={item.publisher ?? ''} onChange={(e) => set('publisher', e.target.value)}
            placeholder="Publisher" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove publication entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={item.releaseDate ?? ''} onChange={(v) => set('releaseDate', v)} placeholder="Release date" />
        <label htmlFor={`${id}-url`} className="sr-only">URL</label>
        <input id={`${id}-url`} type="text" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="URL" className={inputClass} />
      </div>
      <label htmlFor={`${id}-summary`} className="sr-only">Summary</label>
      <RichTextField
        id={`${id}-summary`}
        value={item.summary ?? ''}
        onChange={(v) => set('summary', v)}
        placeholder="Summary..."
        rows={2}
      />
    </div>
  )
}

export function PublicationsForm() {
  const items = useResumeEditorStore((s) => s.data.publications ?? EMPTY_ITEMS)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('publications', v)}
      createEmpty={createEmpty} addLabel="Add publication"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
