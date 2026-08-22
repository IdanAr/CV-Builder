'use client'

import { useEffect, useState } from 'react'
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

  async function load() {
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
  }

  useEffect(() => {
    async function loadOnMount() {
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
    }
    loadOnMount()
  }, [])

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

  if (error) {
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

  if (showWizard) {
    return (
      <ProfileWizard
        onCreated={() => {
          setShowWizard(false)
          load()
        }}
      />
    )
  }

  if (profiles.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <p className="text-sm text-gray-500">No job search profiles yet.</p>
        <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setShowWizard(true)}>
          Create a profile
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" className="rounded bg-indigo-600 px-4 py-2 text-sm text-white" onClick={() => setShowWizard(true)}>
          Create profile
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {profiles.map((profile) => (
          <li key={profile._id} className="flex items-center justify-between rounded border px-4 py-2">
            <span>{profile.name}</span>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                aria-label="Active"
                checked={profile.isActive}
                onChange={() => toggleActive(profile)}
              />
              Active
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}
