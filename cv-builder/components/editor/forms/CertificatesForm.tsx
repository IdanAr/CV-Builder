'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['certificates']>[number]
const createEmpty = (): Item => ({ name: '', date: '', issuer: '', url: '' })
const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Certificate name" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove certificate"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.issuer ?? ''} onChange={(e) => set('issuer', e.target.value)}
          placeholder="Issuing organization" className={inputClass} />
        <input type="text" value={item.date ?? ''} onChange={(e) => set('date', e.target.value)}
          placeholder="Date (2023-05)" className={inputClass} />
      </div>
      <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
        placeholder="Certificate URL" className={inputClass} />
    </div>
  )
}

export function CertificatesForm() {
  const items = useResumeEditorStore((s) => s.data.certificates ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('certificates', v)}
      createEmpty={createEmpty} addLabel="Add certificate"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
