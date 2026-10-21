'use client'

import { inputClass } from '@/components/editor/forms/field-styles'
import { cn } from '@/lib/utils'
import type { CoverLetterNotes } from '@/lib/schemas/cover-letter.zod'

// Mirrors CoverLetterNotesSchema's caps, so the browser stops the typing before the server rejects it.
const NOTE_MAX = 1000
const HIRING_MANAGER_MAX = 120

const labelClass = 'mb-1 block text-xs text-fg-muted'

function Optional() {
  return <span className="text-fg-subtle"> (optional)</span>
}

/**
 * The candidate's own words for one letter: why this job, anything to explain,
 * and who to address. All optional. `situation` lines (what the CV's dates
 * show, such as a gap) sit above "Anything to explain" and describe that field.
 */
export function LetterNotes({
  idPrefix,
  value,
  onChange,
  onBlur,
  situation = [],
}: {
  idPrefix: string
  value: CoverLetterNotes
  onChange: (next: CoverLetterNotes) => void
  onBlur?: () => void
  situation?: string[]
}) {
  const set = (key: keyof CoverLetterNotes) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...value, [key]: e.target.value })
  const situationId = `${idPrefix}-situation`

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-motivation`} className={labelClass}>
          Why this company or role<Optional />
        </label>
        <textarea
          id={`${idPrefix}-motivation`}
          value={value.motivation ?? ''}
          onChange={set('motivation')}
          onBlur={onBlur}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="What draws you to this job, in your own words."
          className={cn(inputClass, 'resize-y py-2 leading-relaxed')}
        />
      </div>

      <div>
        {situation.length > 0 && (
          <div id={situationId} className="mb-1.5 space-y-1">
            {situation.map((line, i) => (
              <p key={`${i}-${line}`} className="rounded-control bg-surface-attention px-2.5 py-1.5 text-xs text-fg-attention">
                {line}
              </p>
            ))}
          </div>
        )}
        <label htmlFor={`${idPrefix}-explain`} className={labelClass}>
          Anything to explain<Optional />
        </label>
        <textarea
          id={`${idPrefix}-explain`}
          value={value.explain ?? ''}
          onChange={set('explain')}
          onBlur={onBlur}
          maxLength={NOTE_MAX}
          rows={2}
          aria-describedby={situation.length > 0 ? situationId : undefined}
          placeholder="A gap, a career change, a move. One or two sentences."
          className={cn(inputClass, 'resize-y py-2 leading-relaxed')}
        />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-manager`} className={labelClass}>
          Hiring manager&apos;s name<Optional />
        </label>
        <input
          id={`${idPrefix}-manager`}
          type="text"
          value={value.hiringManager ?? ''}
          onChange={set('hiringManager')}
          onBlur={onBlur}
          maxLength={HIRING_MANAGER_MAX}
          autoComplete="off"
          className={inputClass}
        />
      </div>
    </div>
  )
}
