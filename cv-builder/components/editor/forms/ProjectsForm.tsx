'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['projects']>[number]
const createEmpty = (): Item => ({
  name: '', description: '', highlights: [], keywords: [],
  startDate: '', endDate: '', url: '', roles: [], entity: '', type: '',
})
const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function StringListEditor({ label, items, onChange, addLabel, placeholder }: {
  label: string; items: string[]; onChange: (v: string[]) => void; addLabel: string; placeholder: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-indigo-600">{label}</label>
      {items.map((v, i) => (
        <div key={i} className="flex gap-1">
          <input type="text" value={v}
            onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))}
            placeholder={placeholder} className={`${inputClass} flex-1`} />
          <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
            aria-label={`Remove ${label.toLowerCase()} item`}
            className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...items, ''])}
        className="text-xs text-indigo-600 hover:text-indigo-800">+ {addLabel}</button>
    </div>
  )
}

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
          placeholder="Project name" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove project"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <textarea value={item.description ?? ''} onChange={(e) => set('description', e.target.value)}
        placeholder="Project description..." rows={2}
        className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
          placeholder="Start date" className={inputClass} />
        <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
          placeholder="End date" className={inputClass} />
      </div>
      <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
        placeholder="Project URL" className={inputClass} />
      <StringListEditor label="Highlights" items={item.highlights ?? []}
        onChange={(v) => onUpdate({ ...item, highlights: v })}
        addLabel="Add highlight" placeholder="Key achievement..." />
      <StringListEditor label="Keywords" items={item.keywords ?? []}
        onChange={(v) => onUpdate({ ...item, keywords: v })}
        addLabel="Add keyword" placeholder="Technology / skill..." />
    </div>
  )
}

export function ProjectsForm() {
  const items = useResumeEditorStore((s) => s.data.projects ?? [])
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('projects', v)}
      createEmpty={createEmpty} addLabel="Add project"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
