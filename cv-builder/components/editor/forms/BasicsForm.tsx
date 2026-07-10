// components/editor/forms/BasicsForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
import { RichTextField } from './RichTextField'
import { inputClass, labelClass } from './field-styles'
import type { ResumeData } from '@/lib/schemas/resume.zod'

type Basics = NonNullable<ResumeData['basics']>

const EMPTY_BASICS: Basics = {}

export function BasicsForm() {
  const basics = useResumeEditorStore((s) => s.data.basics ?? EMPTY_BASICS)
  const resumeId = useResumeEditorStore((s) => s.resumeId)
  const setSectionData = useResumeEditorStore((s) => s.setSectionData)

  const set = (field: string, value: string) =>
    setSectionData('basics', { ...basics, [field]: value })

  const setLocation = (field: string, value: string) =>
    setSectionData('basics', { ...basics, location: { ...basics.location, [field]: value } })

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Full Name</label>
          <input type="text" value={basics.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Jane Smith" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Job Title</label>
          <input type="text" value={basics.label ?? ''} onChange={(e) => set('label', e.target.value)}
            placeholder="Software Engineer" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Email</label>
          <input type="email" value={basics.email ?? ''} onChange={(e) => set('email', e.target.value)}
            placeholder="jane@example.com" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Phone</label>
          <input type="tel" value={basics.phone ?? ''} onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 555 123 4567" className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Website URL</label>
        <input type="url" value={basics.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="https://janesmith.dev" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>City</label>
          <input type="text" value={basics.location?.city ?? ''}
            onChange={(e) => setLocation('city', e.target.value)}
            placeholder="San Francisco" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Region</label>
          <input type="text" value={basics.location?.region ?? ''}
            onChange={(e) => setLocation('region', e.target.value)}
            placeholder="CA" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Country</label>
          <input type="text" value={basics.location?.countryCode ?? ''}
            onChange={(e) => setLocation('countryCode', e.target.value)}
            placeholder="US" className={inputClass} />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-indigo-600">Professional Summary</label>
          <AiSuggestButton
            resumeId={resumeId}
            currentValue={basics.summary ?? ''}
            context={{ field: 'summary' }}
            onAccept={(v) => set('summary', v)}
          />
        </div>
        <RichTextField
          value={basics.summary ?? ''}
          onChange={(v) => set('summary', v)}
          placeholder="Brief professional summary..."
          rows={4}
        />
      </div>
    </div>
  )
}
