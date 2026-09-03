'use client'

import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import { MonthYearPicker } from './MonthYearPicker'
import { RichTextField } from './RichTextField'
import { resolveCustomSectionRoles } from '@/lib/roles'
import { CUSTOM_SECTION_FIELDS } from '@/lib/schemas/resume.zod'
import { inputClass as sharedInputClass } from './field-styles'
import type { CustomSection, CustomSectionItem, CustomSectionRole, CustomSectionFieldType } from '@/lib/schemas/resume.zod'
import { X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

const FIELD_LABELS: Record<CustomSectionFieldType, string> = {
  subtitle: 'Subtitle',
  dateRange: 'Dates',
  url: 'URL',
  summary: 'Text',
  highlights: 'Bullets',
  keywords: 'Keywords',
  level: 'Level',
  roles: 'Roles',
}

const inputClass = `${sharedInputClass} appearance-none`

function createEmptyItem(): CustomSectionItem {
  return { id: crypto.randomUUID() }
}

function createEmptyRole(): CustomSectionRole {
  return { id: crypto.randomUUID() }
}

interface ItemFormProps {
  item: CustomSectionItem
  enabledFields: CustomSectionFieldType[]
  resumeId: string
  onUpdate: (v: CustomSectionItem) => void
  onRemove: () => void
}

function ItemForm({ item, enabledFields, resumeId, onUpdate, onRemove }: ItemFormProps) {
  const id = useId()
  const set = (f: keyof CustomSectionItem, v: string) => onUpdate({ ...item, [f]: v })
  const setArr = (f: 'highlights' | 'keywords', v: string[]) => onUpdate({ ...item, [f]: v })
  const hasRoles = enabledFields.includes('roles')

  const roles = resolveCustomSectionRoles(item)
  const setRoles = (roles: CustomSectionRole[]) => onUpdate({
    ...item, roles,
    subtitle: undefined, startDate: undefined, endDate: undefined, summary: undefined,
    highlights: undefined, keywords: undefined, level: undefined,
  })

  // url has no per-role equivalent (same as Work/Education's company-level
  // url) — it always stays on the item, whether or not roles is enabled.
  const urlField = enabledFields.includes('url') && (
    <>
      <label htmlFor={`${id}-url`} className="sr-only">URL</label>
      <input id={`${id}-url`} type="url" value={item.url ?? ''} onChange={(e) => set('url', e.target.value)}
        placeholder="URL" className={inputClass} />
    </>
  )

  const flatFields = (
    <>
      {enabledFields.includes('subtitle') && (
        <>
          <label htmlFor={`${id}-subtitle`} className="sr-only">Subtitle</label>
          <input id={`${id}-subtitle`} type="text" value={item.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)}
            placeholder="Subtitle" className={inputClass} />
        </>
      )}

      {enabledFields.includes('dateRange') && (
        <div className="grid grid-cols-2 gap-2">
          <MonthYearPicker value={item.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
          <MonthYearPicker value={item.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
        </div>
      )}

      {urlField}

      {enabledFields.includes('summary') && (
        <div className="flex items-start gap-1">
          <div className="flex-1">
            <label htmlFor={`${id}-summary`} className="sr-only">Description</label>
            <RichTextField
              id={`${id}-summary`}
              value={item.summary ?? ''}
              onChange={(v) => set('summary', v)}
              placeholder="Description..."
            />
          </div>
          <AiSuggestButton
            resumeId={resumeId}
            currentValue={item.summary ?? ''}
            context={{ jobTitle: item.title, field: 'summary' }}
            onAccept={(v) => set('summary', v)}
          />
        </div>
      )}

      {enabledFields.includes('highlights') && (
        <fieldset className="space-y-1 border-0 p-0 m-0">
          <legend className="text-xs text-fg-muted font-medium p-0">Bullets</legend>
          <ListFieldManager<string>
            items={item.highlights ?? []}
            onChange={(v) => setArr('highlights', v)}
            createEmpty={() => ''}
            addLabel="Add bullet"
            renderItem={(h, i, onUpdateHighlight, onRemoveHighlight) => (
              <div className="flex gap-2 items-start">
                <RichTextField
                  value={h}
                  onChange={onUpdateHighlight}
                  placeholder="Bullet point..."
                  ariaLabel={`Bullet ${i + 1}`}
                  className="flex-1"
                  height={80}
                />
                <AiSuggestButton
                  resumeId={resumeId}
                  currentValue={h}
                  context={{ jobTitle: item.title, field: 'highlight' }}
                  onAccept={onUpdateHighlight}
                />
                <button type="button" onClick={onRemoveHighlight}
                  className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-6 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
              </div>
            )}
          />
        </fieldset>
      )}

      {enabledFields.includes('keywords') && (
        <div className="space-y-1">
          <div className="text-xs text-fg-muted font-medium">Keywords</div>
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
          <label htmlFor={`${id}-keyword-input`} className="sr-only">Add keyword</label>
          <input id={`${id}-keyword-input`} type="text" placeholder="Add keyword, press Enter" className={inputClass}
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
        <>
          <label htmlFor={`${id}-level`} className="sr-only">Level</label>
          <select id={`${id}-level`} value={item.level ?? ''} onChange={(e) => set('level', e.target.value)}
            className={inputClass}>
            <option value="">Select level…</option>
            <option value="Expert">Expert</option>
            <option value="Advanced">Advanced</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Beginner">Beginner</option>
          </select>
        </>
      )}
    </>
  )

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <label htmlFor={`${id}-title`} className="sr-only">Title</label>
        <input id={`${id}-title`} type="text" value={item.title ?? ''} onChange={(e) => set('title', e.target.value)}
          placeholder="Title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove item"
          className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-1 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </div>

      {hasRoles ? (
        <div className="pl-3 border-l-2 border-indigo-100 space-y-3">
          {urlField && <div className="space-y-2">{urlField}</div>}
          <ListFieldManager<CustomSectionRole>
            items={roles}
            onChange={setRoles}
            createEmpty={createEmptyRole}
            addLabel="Add role"
            renderItem={(role, _, onUpdateRole, onRemoveRole) => (
              <RoleForm role={role} enabledFields={enabledFields} resumeId={resumeId} onUpdate={onUpdateRole} onRemove={onRemoveRole} />
            )}
          />
        </div>
      ) : (
        <div className="space-y-2">{flatFields}</div>
      )}
    </div>
  )
}

function RoleForm({
  role, enabledFields, resumeId, onUpdate, onRemove,
}: {
  role: CustomSectionRole
  enabledFields: CustomSectionFieldType[]
  resumeId: string
  onUpdate: (v: CustomSectionRole) => void
  onRemove: () => void
}) {
  const id = useId()
  const set = (f: 'title' | 'subtitle' | 'startDate' | 'endDate' | 'summary' | 'level', v: string) => onUpdate({ ...role, [f]: v })
  const setArr = (f: 'highlights' | 'keywords', v: string[]) => onUpdate({ ...role, [f]: v })
  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        <label htmlFor={`${id}-title`} className="sr-only">Title</label>
        <input id={`${id}-title`} type="text" value={role.title ?? ''} onChange={(e) => set('title', e.target.value)}
          placeholder="Title" className={`${inputClass} flex-1`} />
        <button type="button" onClick={onRemove} aria-label="Remove role"
          className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-1 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
      </div>
      {enabledFields.includes('subtitle') && (
        <input type="text" value={role.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)}
          placeholder="Subtitle" className={inputClass} />
      )}
      {enabledFields.includes('dateRange') && (
        <div className="grid grid-cols-2 gap-2">
          <MonthYearPicker value={role.startDate ?? ''} onChange={(v) => set('startDate', v)} placeholder="Start date" />
          <MonthYearPicker value={role.endDate ?? ''} onChange={(v) => set('endDate', v)} allowPresent placeholder="End date" />
        </div>
      )}
      {enabledFields.includes('summary') && (
        <div className="flex items-start gap-1">
          <div className="flex-1">
            <RichTextField value={role.summary ?? ''} onChange={(v) => set('summary', v)} placeholder="Description..." />
          </div>
          <AiSuggestButton
            resumeId={resumeId}
            currentValue={role.summary ?? ''}
            context={{ jobTitle: role.title, field: 'summary' }}
            onAccept={(v) => set('summary', v)}
          />
        </div>
      )}
      {enabledFields.includes('highlights') && (
        <fieldset className="space-y-1 border-0 p-0 m-0">
          <legend className="text-xs text-fg-muted font-medium p-0">Bullets</legend>
          <ListFieldManager<string>
            items={role.highlights ?? []}
            onChange={(v) => setArr('highlights', v)}
            createEmpty={() => ''}
            addLabel="Add bullet"
            renderItem={(h, i, onUpdateHighlight, onRemoveHighlight) => (
              <div className="flex gap-2 items-start">
                <RichTextField
                  value={h}
                  onChange={onUpdateHighlight}
                  placeholder="Bullet point..."
                  ariaLabel={`Bullet ${i + 1}`}
                  className="flex-1"
                  height={120}
                />
                <AiSuggestButton
                  resumeId={resumeId}
                  currentValue={h}
                  context={{ jobTitle: role.title, field: 'highlight' }}
                  onAccept={onUpdateHighlight}
                />
                <button type="button" onClick={onRemoveHighlight}
                  className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'mt-6 h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
              </div>
            )}
          />
        </fieldset>
      )}
      {enabledFields.includes('keywords') && (
        <div className="space-y-1">
          <div className="text-xs text-fg-muted font-medium">Keywords</div>
          <div className="flex flex-wrap gap-1">
            {(role.keywords ?? []).map((kw, i) => (
              <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs">
                {kw}
                <button type="button"
                  onClick={() => setArr('keywords', (role.keywords ?? []).filter((_, idx) => idx !== i))}
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
                  setArr('keywords', [...(role.keywords ?? []), val]);
                  (e.target as HTMLInputElement).value = ''
                }
              }
            }} />
        </div>
      )}
      {enabledFields.includes('level') && (
        <select value={role.level ?? ''} onChange={(e) => set('level', e.target.value)} className={inputClass}>
          <option value="">Select level…</option>
          <option value="Expert">Expert</option>
          <option value="Advanced">Advanced</option>
          <option value="Intermediate">Intermediate</option>
          <option value="Beginner">Beginner</option>
        </select>
      )}
    </div>
  )
}

export function CustomSectionForm({ sectionId }: { sectionId: string }) {
  const section = useResumeEditorStore(
    (s) => s.data.customSections?.find((cs) => cs.id === sectionId)
  ) as CustomSection | undefined
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const updateCustomSection = useResumeEditorStore((s) => s.updateCustomSection)

  if (!section) return null

  function toggleField(field: CustomSectionFieldType) {
    const current = useResumeEditorStore.getState().data.customSections?.find(
      (cs) => cs.id === sectionId
    )
    if (!current) return
    const has = current.enabledFields.includes(field)
    updateCustomSection(sectionId, {
      enabledFields: has
        ? current.enabledFields.filter((f) => f !== field)
        : [...current.enabledFields, field],
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Enabled fields">
        {CUSTOM_SECTION_FIELDS.map((field) => {
          const active = section.enabledFields.includes(field)
          return (
            <button
              key={field}
              type="button"
              onClick={() => toggleField(field)}
              aria-pressed={active}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                active
                  ? 'bg-indigo-500 border-indigo-500 text-white'
                  : 'bg-white border-indigo-200 text-fg-muted hover:border-indigo-400'
              }`}
            >
              {FIELD_LABELS[field]}
            </button>
          )
        })}
      </div>

      <ListFieldManager<CustomSectionItem>
        sectionKey={`custom:${sectionId}`}
        items={section.items}
        onChange={(items) => updateCustomSection(sectionId, { items })}
        createEmpty={createEmptyItem}
        addLabel="Add entry"
        renderItem={(item, _, onUpdate, onRemove) => (
          <ItemForm
            item={item}
            enabledFields={section.enabledFields}
            resumeId={resumeId}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        )}
      />
    </div>
  )
}
