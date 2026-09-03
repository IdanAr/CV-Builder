'use client'

import { useCallback, useEffect, useState } from 'react'
import { ProfileWizard } from './ProfileWizard'
import { COUNTRIES } from '@/lib/jobsearch/countries'
import type { WorkMode, Seniority, JobLocation, ComeetCompanyWatch } from '@/lib/schemas/jobsearch.zod'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

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
}

export function ProfileSettings({ profileId }: ProfileSettingsProps) {
  const [profile, setProfile] = useState<FullProfile | null>(null)
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  if (error && profile === null) {
    return <ErrorBanner>{error}</ErrorBanner>
  }

  if (profile === null) return null

  if (editing) {
    return (
      <div className="rounded border p-4">
        <ProfileWizard
          existingProfile={profile}
          onUpdated={() => {
            setEditing(false)
            load()
          }}
        />
        <button type="button" className="mt-3 text-sm text-gray-500 hover:underline" onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    )
  }

  const countryName = COUNTRIES.find((c) => c.code === profile.locations[0]?.country)?.name

  return (
    <div className="flex flex-col gap-2 rounded border px-4 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Search preferences</h3>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => setEditing(true)}
        >
          Edit preferences
        </button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="font-medium text-gray-600">Roles</dt>
        <dd>{profile.roles.length > 0 ? profile.roles.join(', ') : '-'}</dd>
        <dt className="font-medium text-gray-600">Location</dt>
        <dd>{[countryName, profile.locations[0]?.city].filter(Boolean).join(', ') || '-'}</dd>
        <dt className="font-medium text-gray-600">Watched companies</dt>
        <dd>
          {/* A profile saved before this field existed comes back from a .lean()
              read without comeetCompanies at all (Mongoose doesn't backfill schema
              defaults onto pre-existing documents) — fall back to an empty list. */}
          {(() => {
            const companies = profile.comeetCompanies ?? []
            return companies.length > 0 ? companies.map((c) => c.name).join(', ') : '-'
          })()}
        </dd>
        <dt className="font-medium text-gray-600">Recency / threshold</dt>
        <dd>
          {profile.recencyDays} days · {profile.minAtsScore}%
        </dd>
      </dl>
    </div>
  )
}
