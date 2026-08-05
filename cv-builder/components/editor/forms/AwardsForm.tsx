'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { inputClass } from './field-styles'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['awards']>[number]
const EMPTY_ITEMS: Item[] = []
const createEmpty = (): Item => ({
  title: '', date: '', awarder: '', summary: '',
})

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const id = useId()
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <label htmlFor={`${id}-title`} className="sr-only">Award title</label>
          <input id={`${id}-title`} type="text" value={item.title ?? ''} onChange={(e) => set('title', e.target.value)}
            placeholder="Award title" className={inputClass} />
          <label htmlFor={`${id}-awarder`} className="sr-only">Awarder</label>
          <input id={`${id}-awarder`} type="text" value={item.awarder ?? ''} onChange={(e) => set('awarder', e.target.value)}
            placeholder="Awarder" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove award entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <MonthYearPicker value={item.date ?? ''} onChange={(v) => set('date', v)} placeholder="Date" />
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

export function AwardsForm() {
  const items = useResumeEditorStore((s) => s.data.awards ?? EMPTY_ITEMS)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('awards', v)}
      createEmpty={createEmpty} addLabel="Add award"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
