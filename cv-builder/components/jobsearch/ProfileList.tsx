'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ProfileWizard } from './ProfileWizard'

interface ProfileSummary {
  _id: string
  name: string
  isActive: boolean
}

async function loadProfilesData() {
  const res = await fetch('/api/jobsearch/profiles')
  const body = await res.json()
  return { ok: res.ok, profiles: body.profiles }
}

export function ProfileList() {
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { ok, profiles: data } = await loadProfilesData()
      if (ok) {
        setProfiles(data)
      } else {
        setError('Failed to load profiles. Please try again.')
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    }
  }, [])

  useEffect(() => {
    // Initial fetch-on-mount, same pattern/suppression as ActivityLog.tsx's load effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  async function toggleActive(profile: ProfileSummary) {
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/profiles/${profile._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !profile.isActive }),
      })
      if (res.ok) {
        await load()
      } else {
        setError('Failed to update profile. Please try again.')
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    }
  }

  async function deleteProfile(profile: ProfileSummary) {
    if (!window.confirm(`Delete "${profile.name}"? This can't be undone.`)) return
    setError(null)
    try {
      const res = await fetch(`/api/jobsearch/profiles/${profile._id}`, { method: 'DELETE' })
      if (res.ok) {
        await load()
      } else {
        setError('Failed to delete profile. Please try again.')
      }
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    }
  }

  // Only fully replace the view with an error screen when the very first load
  // failed and there's nothing to show yet. Once profiles have loaded
  // successfully, a later failed reload/toggle shows an inline banner above
  // the still-intact list instead — mirrors ProfileWizard's error convention.
  if (error && profiles === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => load()}>
          Try again
        </button>
      </div>
    )
  }

  if (profiles === null) return null

  const errorBanner = error ? <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null

  if (showWizard) {
    return (
      <div className="flex flex-col gap-4">
        {errorBanner}
        <ProfileWizard
          onCreated={() => {
            setShowWizard(false)
            load()
          }}
          onCancel={() => setShowWizard(false)}
        />
      </div>
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {errorBanner}
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-sm text-gray-500">No job search profiles yet.</p>
          <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setShowWizard(true)}>
            Create a profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {errorBanner}
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setShowWizard(true)}>
            Create profile
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {profiles.map((profile) => (
            <li key={profile._id} className="flex items-center justify-between rounded border px-4 py-2">
              <Link href={`/dashboard/jobsearch/${profile._id}`} className="font-medium text-indigo-700 hover:underline">
                {profile.name}
              </Link>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    aria-label="Active"
                    checked={profile.isActive}
                    onChange={() => toggleActive(profile)}
                  />
                  Active
                </label>
                <button
                  type="button"
                  aria-label={`Delete ${profile.name}`}
                  className="text-sm text-red-600 hover:underline"
                  onClick={() => deleteProfile(profile)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
