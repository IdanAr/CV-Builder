'use client'

import { useEffect, useRef, useState } from 'react'
import { MAX_COMEET_COMPANIES, type ComeetCompanyWatch } from '@/lib/schemas/jobsearch.zod'
import { Button } from '@/components/ui/Button'
import { fieldClass, helperClass, labelClass } from './field'
import { TagChip, TagInput } from './TagInput'
import type { StepProps } from './StepRole'

export function StepSources({ values, onChange }: StepProps) {
  const [url, setUrl] = useState('')
  const [resolving, setResolving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The lookup is async, so the closure's `values` can be stale by the time the
  // response arrives (the user may have removed a tag meanwhile). Read the
  // current list through a ref instead.
  const valuesRef = useRef(values)
  useEffect(() => {
    valuesRef.current = values
  })

  // Resolves the pasted careers-page URL server-side into a full {name, uid, token}
  // entry; the user never sees or types the UID or token themselves.
  async function handleAdd() {
    const trimmed = url.trim()
    if (!trimmed) return
    if (values.comeetCompanies.length >= MAX_COMEET_COMPANIES) {
      setError(`You can watch up to ${MAX_COMEET_COMPANIES} companies.`)
      return
    }
    if (values.comeetCompanies.some((c) => c.uid && trimmed.includes(c.uid))) {
      setError('That company is already in the list.')
      return
    }
    setResolving(true)
    setError(null)
    try {
      const res = await fetch('/api/jobsearch/comeet/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? 'Could not look up that page. Try again.')
        return
      }
      const company = body.company as ComeetCompanyWatch
      const current = valuesRef.current.comeetCompanies
      if (current.length >= MAX_COMEET_COMPANIES) {
        setError(`You can watch up to ${MAX_COMEET_COMPANIES} companies.`)
        return
      }
      if (current.some((c) => c.uid === company.uid)) {
        setError('That company is already in the list.')
        return
      }
      onChange({ comeetCompanies: [...current, company] })
      setUrl('')
    } catch {
      setError('Could not look up that page. Try again.')
    } finally {
      setResolving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className={labelClass}>Watch specific companies</span>
        <p className={helperClass}>
          Optional. For employers that hire through Comeet, paste the company&apos;s public careers page and we&apos;ll
          look it up.
        </p>
        {values.comeetCompanies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {values.comeetCompanies.map((company, index) => (
              <TagChip
                key={`${index}|${company.uid}`}
                label={company.name}
                onRemove={() => onChange({ comeetCompanies: values.comeetCompanies.filter((_, i) => i !== index) })}
              />
            ))}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="comeet-url" className="text-xs text-fg-subtle">
            Company careers page URL
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="comeet-url"
              className={fieldClass}
              placeholder="https://www.comeet.com/jobs/company-name/uid"
              value={url}
              disabled={resolving}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  void handleAdd()
                }
              }}
            />
            <Button type="button" variant="secondary" size="md" className="shrink-0" disabled={resolving} onClick={() => void handleAdd()}>
              {resolving ? 'Looking up…' : 'Add company'}
            </Button>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-fg-danger">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-fg-heading">Refine results</span>
          <p className={helperClass}>Optional. Press Enter to add each one.</p>
        </div>
        <TagInput
          id="profile-categories"
          label="Categories"
          values={values.categories}
          onChange={(categories) => onChange({ categories })}
          placeholder="Engineering"
        />
        <TagInput
          id="profile-industries"
          label="Industries"
          values={values.industries}
          onChange={(industries) => onChange({ industries })}
          placeholder="Fintech"
          helper="Soft-matched against results, not queried directly."
        />
      </div>
    </div>
  )
}
