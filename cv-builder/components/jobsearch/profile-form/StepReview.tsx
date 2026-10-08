'use client'

import { Button } from '@/components/ui/Button'
import { RECENCY_PRESETS, fitHint, locationLabel } from './model'
import { fieldClass, helperClass, labelClass } from './field'
import { ToggleChipGroup } from './ToggleChipGroup'
import type { StepProps } from './StepRole'

export interface ResumeOption {
  id: string
  title: string
}

function formatList(items: string[]): string {
  return items.length > 0 ? items.join(', ') : 'None'
}

function SummaryRow({ label, value, step, onJumpTo }: { label: string; value: string; step: number; onJumpTo: (step: number) => void }) {
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-fg-body">{value}</dd>
      <dd>
        <Button type="button" variant="link" size="xs" aria-label={`Edit ${label.toLowerCase()}`} onClick={() => onJumpTo(step)}>
          Edit
        </Button>
      </dd>
    </>
  )
}

export function StepReview({
  values,
  onChange,
  resumeOptions,
  isEditing,
  onJumpTo,
}: StepProps & { resumeOptions: ResumeOption[]; isEditing: boolean; onJumpTo: (step: number) => void }) {
  const recencyOptions = (RECENCY_PRESETS as readonly number[]).includes(values.recencyDays)
    ? [...RECENCY_PRESETS]
    : [...RECENCY_PRESETS, values.recencyDays].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-[6.5rem_1fr_auto] items-baseline gap-x-3 gap-y-1.5 rounded-card border border-border bg-surface-subtle px-3 py-3 text-sm max-sm:grid-cols-[5.5rem_1fr_auto]">
        <SummaryRow label="Roles" value={formatList(values.roles)} step={0} onJumpTo={onJumpTo} />
        <SummaryRow label="Seniority" value={formatList(values.seniority)} step={0} onJumpTo={onJumpTo} />
        <SummaryRow label="Work mode" value={values.workModes.length > 0 ? values.workModes.join(', ') : 'Any'} step={1} onJumpTo={onJumpTo} />
        <SummaryRow
          label="Locations"
          value={values.locations.length > 0 ? values.locations.map(locationLabel).join('; ') : 'Anywhere'}
          step={1}
          onJumpTo={onJumpTo}
        />
        <SummaryRow label="Companies" value={formatList(values.comeetCompanies.map((c) => c.name))} step={2} onJumpTo={onJumpTo} />
      </dl>

      <ToggleChipGroup
        label="Only postings from the last"
        options={recencyOptions}
        selected={[values.recencyDays]}
        onToggle={(days) => onChange({ recencyDays: days })}
        format={(days) => `${days} days`}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-fit" className={labelClass}>
          Minimum fit to auto-draft: {values.minAtsScore}%
        </label>
        <input
          id="profile-fit"
          type="range"
          min={0}
          max={100}
          step={5}
          value={values.minAtsScore}
          onChange={(e) => onChange({ minAtsScore: Number(e.target.value) })}
          className="w-full max-sm:min-h-10"
        />
        <p className={helperClass}>{fitHint(values.minAtsScore)}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-resume" className={labelClass}>
          Résumé to tailor from
        </label>
        <select
          id="profile-resume"
          className={fieldClass}
          value={values.resumeId ?? ''}
          onChange={(e) => onChange({ resumeId: e.target.value || undefined })}
        >
          <option value="">Most recently updated</option>
          {resumeOptions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </div>

      {!isEditing && (
        <label className="flex min-h-6 items-center gap-2 text-sm text-fg-body max-sm:min-h-10">
          <input
            type="checkbox"
            checked={values.notifyOnMatch}
            onChange={(e) => onChange({ notifyOnMatch: e.target.checked })}
          />
          Notify me when a match scores {values.minAtsScore}% or higher
        </label>
      )}
    </div>
  )
}
