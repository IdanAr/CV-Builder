'use client'

import { useId } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import { inputClass as sharedInputClass } from './field-styles'
import { createEmptySkill as createEmpty } from '@/lib/schemas/resume-empty-entries'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type SkillItem = NonNullable<ResumeData['skills']>[number]

const EMPTY_SKILLS: SkillItem[] = []

const inputClass = `${sharedInputClass} appearance-none`

function SkillItemForm({ item, onUpdate, onRemove }: { item: SkillItem; onUpdate: (v: SkillItem) => void; onRemove: () => void }) {
  const id = useId()
  const set = (field: keyof SkillItem, value: string) => onUpdate({ ...item, [field as keyof SkillItem]: value as never })
  const setKeywords = (keywords: string[]) => onUpdate({ ...item, keywords })
  const addKeyword = () => setKeywords([...(item.keywords ?? []), ''])
  const updateKeyword = (i: number, v: string) =>
    setKeywords((item.keywords ?? []).map((k, idx) => (idx === i ? v : k)))
  const removeKeyword = (i: number) =>
    setKeywords((item.keywords ?? []).filter((_, idx) => idx !== i))

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-start gap-2">
        <div className="grid grid-cols-2 gap-2 flex-1">
          <label htmlFor={`${id}-name`} className="sr-only">Skill name</label>
          <input id={`${id}-name`} type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Skill name" className={inputClass} />
          <label htmlFor={`${id}-level`} className="sr-only">Skill level</label>
          <select id={`${id}-level`} value={item.level ?? ''} onChange={(e) => set('level', e.target.value)}
            className={inputClass}>
            <option value="">Select level…</option>
            <option value="Expert">Expert</option>
            <option value="Advanced">Advanced</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Beginner">Beginner</option>
          </select>
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove skill"
          className="text-gray-400 hover:text-red-500 text-sm mt-1">✕</button>
      </div>
      <fieldset className="space-y-1 border-0 p-0 m-0">
        <legend className="block text-xs font-medium text-indigo-600 p-0">Keywords</legend>
        {(item.keywords ?? []).map((k, i) => (
          <div key={i} className="flex gap-1">
            <input type="text" value={k} onChange={(e) => updateKeyword(i, e.target.value)}
              placeholder="e.g. React" aria-label={`Keyword ${i + 1}`} className={`${inputClass} flex-1`} />
            <button type="button" onClick={() => removeKeyword(i)} aria-label="Remove keyword"
              className="text-gray-400 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={addKeyword}
          className="text-xs text-indigo-600 hover:text-indigo-800">+ Add keyword</button>
      </fieldset>
    </div>
  )
}

export function SkillsForm() {
  const skills = useResumeEditorStore((s) => s.data.skills ?? EMPTY_SKILLS)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<SkillItem>
      sectionKey="skills"
      items={skills}
      onChange={(items) => setSectionData('skills', items)}
      createEmpty={createEmpty}
      addLabel="Add skill"
      renderItem={(item, _, onUpdate, onRemove) => (
        <SkillItemForm item={item} onUpdate={onUpdate} onRemove={onRemove} />
      )}
    />
  )
}
