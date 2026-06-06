// components/editor/forms/BasicsForm.tsx
'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { AiSuggestButton } from '@/components/ai/AiSuggestButton'
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

  const inputClass =
    'w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-indigo-600 mb-1">Full Name</label>
          <input type="text" value={basics.name ?? ''} onChange={(e) => set('name', e.target.value)}
            placeholder="Jane Smith" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-indigo-600 mb-1">Job Title</label>
          <input type="text" value={basics.label ?? ''} onChange={(e) => set('label', e.target.value)}
            placeholder="Software Engineer" className={inputClass} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-indigo-600 mb-1">Email</label>
          <input type="email" value={basics.email ?? ''} onChange={(e) => set('email', e.target.value)}
            placeholder="jane@example.com" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-indigo-600 mb-1">Phone</label>
          <input type="tel" value={basics.phone ?? ''} onChange={(e) => set('phone', e.target.value)}
            placeholder="+1 555 123 4567" className={inputClass} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-indigo-600 mb-1">Website URL</label>
        <input type="url" value={basics.url ?? ''} onChange={(e) => set('url', e.target.value)}
          placeholder="https://janesmith.dev" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-indigo-600 mb-1">City</label>
          <input type="text" value={basics.location?.city ?? ''}
            onChange={(e) => setLocation('city', e.target.value)}
            placeholder="San Francisco" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-indigo-600 mb-1">Region</label>
          <input type="text" value={basics.location?.region ?? ''}
            onChange={(e) => setLocation('region', e.target.value)}
            placeholder="CA" className={inputClass} />
        </div>
        <div>
          <label className="block text-xs font-medium text-indigo-600 mb-1">Country</label>
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
        <textarea value={basics.summary ?? ''} onChange={(e) => set('summary', e.target.value)}
          placeholder="Brief professional summary..." rows={4}
          className="w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y" />
      </div>
    </div>
  )
}
