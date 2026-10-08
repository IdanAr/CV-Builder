'use client'

import { SENIORITY_LEVELS, type Seniority } from '@/lib/schemas/jobsearch.zod'
import type { ProfileFormValues } from './model'
import { fieldClass, labelClass } from './field'
import { TagInput } from './TagInput'
import { ToggleChipGroup } from './ToggleChipGroup'

export interface StepProps {
  values: ProfileFormValues
  onChange: (patch: Partial<ProfileFormValues>) => void
}

export function StepRole({ values, onChange, nameError }: StepProps & { nameError?: string | null }) {
  function toggleSeniority(level: Seniority) {
    onChange({
      seniority: values.seniority.includes(level)
        ? values.seniority.filter((l) => l !== level)
        : [...values.seniority, level],
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="profile-name" className={labelClass}>
          Profile name
        </label>
        <input
          id="profile-name"
          className={fieldClass}
          value={values.name}
          placeholder="Frontend roles in Tel Aviv"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? 'profile-name-error' : undefined}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {nameError && (
          <p id="profile-name-error" role="alert" className="text-sm text-fg-danger">
            {nameError}
          </p>
        )}
      </div>
      <TagInput
        id="profile-roles"
        label="Target roles"
        values={values.roles}
        onChange={(roles) => onChange({ roles })}
        placeholder="Type a role and press Enter"
        // Mirrors MAX_ROLE_QUERIES in lib/jobsearch/scan.ts: only the first 5 are searched.
        helper="Each role is searched separately. The first 5 are used on each scan."
      />
      <ToggleChipGroup
        label="Seniority"
        options={SENIORITY_LEVELS}
        selected={values.seniority}
        onToggle={toggleSeniority}
      />
    </div>
  )
}
