'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { CUSTOM_SECTION_FIELDS } from '@/lib/schemas/resume.zod'
import type { CustomSection, CustomSectionItem, CustomSectionFieldType } from '@/lib/schemas/resume.zod'

const FIELD_LABELS: Record<CustomSectionFieldType, string> = {
  subtitle: 'Subtitle',
  dateRange: 'Dates',
  url: 'URL',
  summary: 'Text',
  highlights: 'Bullets',
  keywords: 'Keywords',
  level: 'Level',
}

const inputClass =
  'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function createEmptyItem(): CustomSectionItem {
  return { id: crypto.randomUUID() }
}

interface ItemFormProps {
  item: CustomSectionItem
  enabledFields: CustomSectionFieldType[]
  onUpdate: (v: CustomSectionItem) => void
  onRemove: () => void
}

function ItemForm({ item, enabledFields, onUpdate, onRemove }: ItemFormProps) {
  const set = (f: keyof CustomSectionItem, v: string) => onUpdate({ ...item, [f]: v })
  const setArr = (f: 'highlights' | 'keywords', v: string[]) => onUpdate({ ...item, [f]: v })

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <input type="text" value={item.title ?? ''} onChange={(e) => set('title', e.target.value)}
          placeholder="Title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove item"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>

      {enabledFields.includes('subtitle') && (
        <input type="text" value={item.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)}
          placeholder="Subtitle" className={inputClass} />
      )}

      {enabledFields.includes('dateRange') && (
        <div className="grid grid-cols-2 gap-2">
          <input type="text" value={item.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)}
            placeholder="Start date" className={inputClass} />
          <input type="text" value={item.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)}
            placeholder="End date" className={inputClass} />
        </div>
      )}

      {enabledFields.includes('url') && (
        <input type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="URL" className={inputClass} />
      )}

      {enabledFields.includes('summary') && (
        <textarea value={item.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
          placeholder="Description..." rows={2}
          className="w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
      )}

      {enabledFields.includes('highlights') && (
        <div className="space-y-1">
          <div className="text-xs text-indigo-500 font-medium">Bullets</div>
          {(item.highlights ?? []).map((h, i) => (
            <div key={i} className="flex gap-2">
              <input type="text" value={h}
                onChange={(e) => {
                  const next = [...(item.highlights ?? [])]
                  next[i] = e.target.value
                  setArr('highlights', next)
                }}
                placeholder="Bullet point..." className={`${inputClass} flex-1`} />
              <button type="button"
                onClick={() => setArr('highlights', (item.highlights ?? []).filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-500 text-sm">✕</button>
            </div>
          ))}
          <button type="button"
            onClick={() => setArr('highlights', [...(item.highlights ?? []), ''])}
            className="text-xs text-indigo-500 hover:text-indigo-700">+ Add bullet</button>
        </div>
      )}

      {enabledFields.includes('keywords') && (
        <div className="space-y-1">
          <div className="text-xs text-indigo-500 font-medium">Keywords</div>
          <div className="flex flex-wrap gap-1">
            {(item.keywords ?? []).map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">
                {kw}
                <button type="button"
                  onClick={() => setArr('keywords', (item.keywords ?? []).filter((_, idx) => idx !== i))}
                  className="hover:text-red-500">×</button>
              </span>
            ))}
          </div>
          <input type="text" placeholder="Add keyword, press Enter" className={inputClass}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                const val = (e.target as HTMLInputElement).value.trim()
                if (val) {
                  setArr('keywords', [...(item.keywords ?? []), val]);
                  (e.target as HTMLInputElement).value = ''
                }
              }
            }} />
        </div>
      )}

      {enabledFields.includes('level') && (
        <input type="text" value={item.level ?? ''} onChange={(e) => set('level', e.target.value)}
          placeholder="Level (e.g. Beginner, Advanced)" className={inputClass} />
      )}
    </div>
  )
}

export function CustomSectionForm({ sectionId }: { sectionId: string }) {
  const section = useResumeEditorStore(
    (s) => s.data.customSections?.find((cs) => cs.id === sectionId)
  ) as CustomSection | undefined
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)

  if (!section) return null

  function toggleField(field: CustomSectionFieldType) {
    const has = section!.enabledFields.includes(field)
    updateCustomSection(sectionId, {
      enabledFields: has
        ? section!.enabledFields.filter((f) => f !== field)
        : [...section!.enabledFields, field],
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {CUSTOM_SECTION_FIELDS.map((field) => {
          const active = section.enabledFields.includes(field)
          return (
            <button
              key={field}
              type="button"
              onClick={() => toggleField(field)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                active
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'bg-white border-indigo-200 text-indigo-400 hover:border-indigo-400'
              }`}
            >
              {FIELD_LABELS[field]}
            </button>
          )
        })}
      </div>

      <ListFieldManager<CustomSectionItem>
        items={section.items}
        onChange={(items) => updateCustomSection(sectionId, { items })}
        createEmpty={createEmptyItem}
        addLabel="Add entry"
        renderItem={(item, _, onUpdate, onRemove) => (
          <ItemForm
            item={item}
            enabledFields={section.enabledFields}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        )}
      />
    </div>
  )
}
