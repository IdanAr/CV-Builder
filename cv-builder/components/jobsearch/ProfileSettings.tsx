'use client'

import { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { ProfileWizard } from './ProfileWizard'
import { COUNTRIES } from '@/lib/jobsearch/countries'
import type { WorkMode, Seniority, JobLocation, ComeetCompanyWatch } from '@/lib/schemas/jobsearch.zod'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { fitBand } from './FitMeter'

interface FullProfile {
  _id: string
  name: string
  resumeId?: string
  roles: string[]
  workModes: WorkMode[]
  locations: JobLocation[]
  seniority: Seniority[]
  categories: string[]
  industries: string[]
  // Optional: a profile saved before this field existed comes back from a .lean()
  // read without it at all (Mongoose doesn't backfill schema defaults onto
  // pre-existing documents).
  comeetCompanies?: ComeetCompanyWatch[]
  recencyDays: number
  minAtsScore: number
}

interface ProfileSettingsProps {
  profileId: string
  /**
   * Server-rendered profile, so the page header and this bar come from one
   * query. Omitted in tests, where it falls back to fetching on mount.
   */
  initialProfile?: FullProfile
}

/**
 * One reading on the preferences bar: a small uppercase label over its value.
 *
 * `accent` is for the two numbers that decide what actually reaches you — the
 * recency window and the score floor — so the settings that do the filtering
 * read differently from the ones that describe the search.
 */
function Indicator({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'accent' | 'success' | 'warning'
}) {
  const valueTone =
    tone === 'success'
      ? 'text-fg-success'
      : tone === 'warning'
      ? 'text-fg-warning'
      : tone === 'accent'
      ? 'text-fg-body'
      : 'text-fg-heading'
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border-r border-border-subtle pr-4 last:border-r-0 last:pr-0">
      <dt className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">{label}</dt>
      <dd className={`truncate text-sm font-semibold tabular-nums ${valueTone}`} title={value}>
        {value}
      </dd>
    </div>
  )
}

export function ProfileSettings({ profileId, initialProfile }: ProfileSettingsProps) {
  const [profile, setProfile] = useState<FullProfile | null>(initialProfile ?? null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobsearch/profiles/${profileId}`)
      if (!res.ok) {
        setError('Failed to load profile preferences.')
        return
      }
      const body = await res.json()
      setProfile(body.profile)
    } catch {
      setError('Failed to load profile preferences.')
    }
  }, [profileId])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ScrapedJobsList.tsx's load effect.
    // Skipped when the server already handed us the profile.
    if (initialProfile) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load, initialProfile])

  if (error && profile === null) {
    return <ErrorBanner>{error}</ErrorBanner>
  }

  if (profile === null) return null

  if (editing) {
    return (
      <Card padding="lg">
        <ProfileWizard
          existingProfile={profile}
          onUpdated={() => {
            setEditing(false)
            load()
          }}
        />
        <Button variant="ghost" className="mt-3" onClick={() => setEditing(false)}>
          Cancel
        </Button>
      </Card>
    )
  }

  const countryName = COUNTRIES.find((c) => c.code === profile.locations[0]?.country)?.name
  const companies = profile.comeetCompanies ?? []
  const location = [countryName, profile.locations[0]?.city].filter(Boolean).join(', ')

  return (
    <Card padding="none" className="flex flex-wrap items-center gap-4 px-4 py-3">
      <dl className="flex min-w-0 flex-1 flex-wrap items-center gap-4">
        <Indicator label="Roles" value={profile.roles.length > 0 ? profile.roles.join(', ') : '-'} />
        <Indicator label="Work mode" value={profile.workModes.length > 0 ? profile.workModes.join(', ') : 'Any'} />
        <Indicator label="Location" value={location || '-'} />
        <Indicator label="Watched companies" value={companies.length > 0 ? companies.map((c) => c.name).join(', ') : '-'} />
        <Indicator label="Recency" value={`${profile.recencyDays} days`} tone="accent" />
        <Indicator
          label="Min fit"
          value={`${profile.minAtsScore}%`}
          // The threshold is coloured by the same bands the fit meter uses, so
          // a demanding floor and a lenient one are told apart at a glance.
          tone={fitBand(profile.minAtsScore).text === 'text-fg-success' ? 'success' : fitBand(profile.minAtsScore).text === 'text-fg-warning' ? 'warning' : 'accent'}
        />
      </dl>
      <Button variant="secondary" size="xs" className="shrink-0" onClick={() => setEditing(true)}>
        <Pencil aria-hidden="true" className="h-3 w-3" />
        Edit preferences
      </Button>
    </Card>
  )
}
