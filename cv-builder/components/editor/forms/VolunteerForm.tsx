'use client'
import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { inputClass } from './field-styles'
import { createEmptyVolunteer as createEmpty } from '@/lib/schemas/resume-empty-entries'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

type Item = NonNullable<ResumeData['volunteer']>[number]
const EMPTY_VOLUNTEER: Item[] = []

function ItemForm({ item, resumeId, onUpdate, onRemove }: { item: Item; resumeId: string; onUpdate: (v: Item) => void; onRemove: () => void }) {
  const id = useId()
  const set = (f: keyof Item, v: string) => onUpdate({ ...item, [f]: v })
  const setHighlights = (highlights: string[]) => onUpdate({ ...item, highlights })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <label htmlFor={`${id}-organization`} className="sr-only">Organization</label>
          <input id={`${id}-organization`} type="text" value={item.organization ?? ''} onChange={(e) => set('organization', e.target.value)}
            placeholder="Organization" className={inputClass} />
          <label htmlFor={`${id}-position`} className="sr-only">Role</label>
          <input id={`${id}-position`} type="text" value={item.position ?? ''} onChange={(e) => set('position', e.target.value)}
            placeholder="Role" className={inputClass} />
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove volunteer entry"
          className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-1 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MonthYearPicker value={item.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
        <MonthYearPicker value={item.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
      </div>
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
          context={{ jobTitle: item.position, company: item.organization, field: 'summary' }}
          onAccept={(v) => set('summary', v)}
        />
      </div>
      <fieldset className="space-y-1 border-0 p-0 m-0">
        <legend className="block text-xs font-medium text-indigo-600 p-0">Highlights</legend>
        <ListFieldManager<string>
          items={item.highlights ?? []}
          onChange={setHighlights}
          createEmpty={() => ''}
          addLabel="Add highlight"
          renderItem={(h, i, onUpdateHighlight, onRemoveHighlight) => (
            <div className="flex gap-1 items-start">
              <RichTextField
                value={h}
                onChange={onUpdateHighlight}
                placeholder="Achievement..."
                ariaLabel={`Highlight ${i + 1}`}
                className="flex-1"
                height={80}
              />
              <AiSuggestButton
                resumeId={resumeId}
                currentValue={h}
                context={{ jobTitle: item.position, company: item.organization, field: 'highlight' }}
                onAccept={onUpdateHighlight}
              />
              <button type="button" onClick={onRemoveHighlight} aria-label="Remove highlight"
                className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-6 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
            </div>
          )}
        />
      </fieldset>
    </div>
  )
}

export function VolunteerForm() {
  const items = useResumeEditorStore((s) => s.data.volunteer ?? EMPTY_VOLUNTEER)
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<Item> sectionKey="volunteer" items={items} onChange={(v) => setSectionData('volunteer', v)}
      createEmpty={createEmpty} addLabel="Add volunteer experience"
      renderItem={(item, _, onUpdate, onRemove) => <ItemForm item={item} resumeId={resumeId} onUpdate={onUpdate} onRemove={onRemove} />} />
  )
}
