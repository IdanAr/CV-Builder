'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { inputClass } from './field-styles'
import { createEmptyAward as createEmpty } from '@/lib/schemas/resume-empty-entries'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

type Item = NonNullable<ResumeData['awards']>[number]
const EMPTY_ITEMS: Item[] = []

function ItemForm({ item, resumeId, onUpdate, onRemove }: { item: Item; resumeId: string; onUpdate: (v: Item) => void; onRemove: () => void }) {
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
          className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-1 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </div>
      <MonthYearPicker value={item.date ?? ''} onChange={(v) => set('date', v)} placeholder="Date" />
      <div className="flex items-start gap-1">
        <div className="flex-1">
          <label htmlFor={`${id}-summary`} className="sr-only">Summary</label>
          <RichTextField
            id={`${id}-summary`}
            value={item.summary ?? ''}
            onChange={(v) => set('summary', v)}
            placeholder="Summary..."
          />
        </div>
        <AiSuggestButton
          resumeId={resumeId}
          currentValue={item.summary ?? ''}
          context={{ jobTitle: item.title, company: item.awarder, field: 'summary' }}
          onAccept={(v) => set('summary', v)}
        />
      </div>
    </div>
  )
}

export function AwardsForm() {
  const items = useResumeEditorStore((s) => s.data.awards ?? EMPTY_ITEMS)
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> sectionKey="awards" items={items} onChange={(v) => setSectionData('awards', v)}
      createEmpty={createEmpty} addLabel="Add award"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} resumeId={resumeId} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
