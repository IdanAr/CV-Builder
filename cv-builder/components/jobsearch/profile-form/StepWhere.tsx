'use client'

import { useState } from 'react'
import { COUNTRIES } from '@/lib/jobsearch/countries'
import { WORK_MODES, MAX_LOCATIONS, type WorkMode } from '@/lib/schemas/jobsearch.zod'
import { Button } from '@/components/ui/Button'
import { addLocation, locationLabel } from './model'
import { fieldClass, helperClass, labelClass } from './field'
import { TagChip } from './TagInput'
import { ToggleChipGroup } from './ToggleChipGroup'
import type { StepProps } from './StepRole'

export interface PendingLocation {
  country: string
  city: string
  /** The selected country was already added together with a city; do not add it again on its own. */
  countryConsumed: boolean
}

export const EMPTY_PENDING: PendingLocation = { country: '', city: '', countryConsumed: false }

interface StepWhereProps extends StepProps {
  /**
   * The not-yet-added country/city. The dialog owns it so a selection that was
   * never added with the button is still committed on Next/Save. Optional so
   * the step works stand-alone, with its own state.
   */
  pending?: PendingLocation
  onPendingChange?: (pending: PendingLocation) => void
}

export function StepWhere({ values, onChange, pending: controlled, onPendingChange }: StepWhereProps) {
  const [local, setLocal] = useState<PendingLocation>(EMPTY_PENDING)
  const pending = controlled ?? local
  const setPending = onPendingChange ?? setLocal
  const { country, city } = pending
  const [error, setError] = useState<string | null>(null)

  function toggleMode(mode: WorkMode) {
    onChange({
      workModes: values.workModes.includes(mode)
        ? values.workModes.filter((m) => m !== mode)
        : [...values.workModes, mode],
    })
  }

  function handleAdd() {
    const result = addLocation(values.locations, { country, city })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    onChange({ locations: result.locations })
    // Keep the country for the next city, but remember it is spent so Next/Save
    // does not add it again as a country-wide entry.
    setPending({ ...pending, city: '', countryConsumed: true })
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <ToggleChipGroup label="Work mode" options={WORK_MODES} selected={values.workModes} onToggle={toggleMode} />
        <p className={helperClass}>Leave empty to match any.</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Locations</span>
        {values.locations.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {values.locations.map((location, index) => (
              <TagChip
                key={`${index}|${location.country ?? ''}|${location.region ?? ''}|${location.city ?? ''}`}
                label={locationLabel(location)}
                onRemove={() => onChange({ locations: values.locations.filter((_, i) => i !== index) })}
              />
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="location-country" className="text-xs text-fg-subtle">
              Country
            </label>
            <select id="location-country" className={fieldClass} value={country} onChange={(e) => setPending({ ...pending, country: e.target.value, countryConsumed: false })}>
              <option value="">Any country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="location-city" className="text-xs text-fg-subtle">
              City
            </label>
            <input
              id="location-city"
              className={fieldClass}
              value={city}
              placeholder="Tel Aviv"
              onChange={(e) => setPending({ ...pending, city: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  handleAdd()
                }
              }}
            />
          </div>
          <Button type="button" variant="secondary" size="md" onClick={handleAdd}>
            Add location
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-fg-danger">
            {error}
          </p>
        )}
        <p className={helperClass}>
          {values.locations.length} of {MAX_LOCATIONS} locations
        </p>
      </div>
    </div>
  )
}
