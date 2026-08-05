'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { MonthYearPicker } from './MonthYearPicker'
import { inputClass } from './field-styles'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['certificates']>[number]
const EMPTY_ITEMS: Item[] = []
const createEmpty = (): Item => ({
  name: '', date: '', issuer: '', url: '',
})

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const id = useId()
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <label htmlFor={`${id}-name`} className="sr-only">Certificate name</label>
          <input id={`${id}-name`} type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Certificate name" className={inputClass} />
          <label htmlFor={`${id}-issuer`} className="sr-only">Issuer</label>
          <input id={`${id}-issuer`} type="text" value={item.issuer ?? ''} onChange={(e) => set('issuer', e.target.value)}
            placeholder="Issuer" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove certificate entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={item.date ?? ''} onChange={(v) => set('date', v)} placeholder="Date" />
        <label htmlFor={`${id}-url`} className="sr-only">URL</label>
        <input id={`${id}-url`} type="text" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="URL" className={inputClass} />
      </div>
    </div>
  )
}

export function CertificatesForm() {
  const items = useResumeEditorStore((s) => s.data.certificates ?? EMPTY_ITEMS)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('certificates', v)}
      createEmpty={createEmpty} addLabel="Add certificate"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
