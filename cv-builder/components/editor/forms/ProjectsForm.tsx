'use client'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { inputClass } from './field-styles'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Item = NonNullable<ResumeData['projects']>[number]
const EMPTY_ITEMS: Item[] = []
// Note: `roles`, `entity`, and `type` exist on ProjectSchema but are intentionally
// not exposed in this form (low practical usage). They are preserved on the item
// object untouched and round-trip through read/write, just not editable here.
const createEmpty = (): Item => ({
  name: '', description: '', highlights: [], keywords: [], startDate: '', endDate: '', url: '',
})

function ItemForm({ item, onUpdate, onRemove }: { item: Item; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  const setHighlights = (highlights: string[]) => onUpdate({ ...item, highlights })
  const addH = () => setHighlights([...(item.highlights ?? []), ''])
  const updateH = (i: number, v: string) =>
    setHighlights((item.highlights ?? []).map((h, idx) => (idx === i ? v : h)))
  const removeH = (i: number) =>
    setHighlights((item.highlights ?? []).filter((_, idx) => idx !== i))
  const setKeywords = (keywords: string[]) => onUpdate({ ...item, keywords })
  const addKeyword = () => setKeywords([...(item.keywords ?? []), ''])
  const updateKeyword = (i: number, v: string) =>
    setKeywords((item.keywords ?? []).map((k, idx) => (idx === i ? v : k)))
  const removeKeyword = (i: number) =>
    setKeywords((item.keywords ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Project name" className={inputClass} />
          <input type="text" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
            placeholder="URL" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove project entry"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={item.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
        <MonthYearPicker value={item.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
      </div>
      <RichTextField
        value={item.description ?? ''}
        onChange={(v) => set('description', v)}
        placeholder="Description..."
        rows={2}
      />
      <div className="space-y-1">
        <label className="block text-xs font-medium text-indigo-600">Highlights</label>
        {(item.highlights ?? []).map((h, i) => (
          <div key={i} className="flex gap-1 items-start">
            <RichTextField
              value={h}
              onChange={(v) => updateH(i, v)}
              placeholder="Achievement..."
              rows={1}
              className="flex-1"
            />
            <button type="button" onClick={() => removeH(i)} aria-label="Remove highlight"
              className="text-gray-400 hover:text-red-500 text-xs px-1 mt-6">✕</button>
          </div>
        ))}
        <button type="button" onClick={addH} className="text-xs text-indigo-600 hover:text-indigo-800">
          + Add highlight
        </button>
      </div>
      <div className="space-y-1">
        <label className="block text-xs font-medium text-indigo-600">Keywords</label>
        {(item.keywords ?? []).map((k, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={k} onChange={(e) => updateKeyword(i, e.target.value)}
              placeholder="e.g. React" className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => removeKeyword(i)} aria-label="Remove keyword"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addKeyword}
          className="text-xs text-indigo-600 hover:text-indigo-800">+ Add keyword</button>
      </div>
    </div>
  )
}

export function ProjectsForm() {
  const items = useResumeEditorStore((s) => s.data.projects ?? EMPTY_ITEMS)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> items={items} onChange={(v) => setSectionData('projects', v)}
      createEmpty={createEmpty} addLabel="Add project"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
