'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { ListFieldManager } from './ListFieldManager'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type SkillItem = NonNullable<ResumeData['skills']>[number]

const EMPTY_SKILLS: SkillItem[] = []

const createEmpty = (): SkillItem => ({ name: '', level: '', keywords: [] })

const inputClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

function SkillItemForm({ item, onUpdate, onRemove }: { item: SkillItem; onUpdate: (v: SkillItem) => void; onRemove: () => void }) {
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
          <input type="text" value={item.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Skill name" className={inputClass} />
          <select value={item.level ?? ''} onChange={(e) => set('level', e.target.value)}
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

export function SkillsForm() {
  const skills = useResumeEditorStore((s) => s.data.skills ?? EMPTY_SKILLS)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)
  return (
    <ListFieldManager<SkillItem>
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
