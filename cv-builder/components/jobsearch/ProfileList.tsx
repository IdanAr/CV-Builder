'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { MoreVertical, Search, Trash2 } from 'lucide-react'
import { ProfileWizard } from './ProfileWizard'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonClasses } from '@/components/ui/Button'
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/ui/Menu'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { formatRelativeTime } from '@/lib/format-relative-time'
import type { JobLocation, WorkMode } from '@/lib/schemas/jobsearch.zod'

const UNDO_DELETE_DURATION = 6000

interface ProfileSummary {
  _id: string
  name: string
  isActive: boolean
  roles?: string[]
  workModes?: WorkMode[]
  locations?: JobLocation[]
  seniority?: string[]
  comeetCompanies?: Array<{ name: string }>
  minAtsScore?: number
  recencyDays?: number
  updatedAt?: string
  newMatchCount?: number
  queuedCount?: number
}

async function loadProfilesData() {
  const res = await fetch('/api/jobsearch/profiles')
  const body = await res.json()
  return { ok: res.ok, profiles: body.profiles }
}

function formatLocation(location: JobLocation): string {
  return [location.city, location.region, location.country].filter(Boolean).join(', ')
}

/**
 * The one-line answer to "what does this profile actually watch?", assembled
 * from fields the record already carries. Ordered most- to least-identifying,
 * so a truncated row still says something useful.
 */
function watchChips(profile: ProfileSummary): Array<{ key: string; label: string; tone: 'accent' | 'neutral' | 'success' }> {
  const chips: Array<{ key: string; label: string; tone: 'accent' | 'neutral' | 'success' }> = []

  for (const role of profile.roles ?? []) {
    chips.push({ key: `role-${role}`, label: role, tone: 'accent' })
  }
  for (const level of profile.seniority ?? []) {
    chips.push({ key: `sen-${level}`, label: level, tone: 'accent' })
  }
  if (profile.workModes?.length) {
    chips.push({ key: 'modes', label: profile.workModes.join(' · '), tone: 'neutral' })
  }
  for (const location of profile.locations ?? []) {
    const label = formatLocation(location)
    if (label) chips.push({ key: `loc-${label}`, label, tone: 'neutral' })
  }
  if (profile.comeetCompanies?.length) {
    const count = profile.comeetCompanies.length
    chips.push({
      key: 'companies',
      label: `${count} ${count === 1 ? 'company' : 'companies'}`,
      tone: 'neutral',
    })
  }
  if (typeof profile.minAtsScore === 'number') {
    chips.push({ key: 'ats', label: `≥ ${profile.minAtsScore}% fit`, tone: 'success' })
  }
  if (typeof profile.recencyDays === 'number') {
    chips.push({ key: 'recency', label: `last ${profile.recencyDays} days`, tone: 'neutral' })
  }

  return chips
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-end leading-tight">
      <span
        className={
          value > 0
            ? 'text-[15px] font-bold tabular-nums text-fg-heading'
            : 'text-[15px] tabular-nums text-fg-subtle'
        }
      >
        {value}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-fg-subtle">{label}</span>
    </div>
  )
}

interface ProfileListProps {
  /**
   * Server-rendered profiles, so the page's stat strip and this list come from
   * one query instead of two. Omitted in tests and anywhere the list stands on
   * its own, where it falls back to fetching on mount.
   */
  initialProfiles?: ProfileSummary[]
}

export function ProfileList({ initialProfiles }: ProfileListProps = {}) {
  const [profiles, setProfiles] = useState<ProfileSummary[] | null>(initialProfiles ?? null)
  const [error, setError] = useState<string | null>(null)
  const [showWizard, setShowWizard] = useState(false)
  const [scanningId, setScanningId] = useState<string | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  // id -> pending DELETE timer. A profile in here is hidden from the list but
  // not yet deleted server-side, so the undo toast can still call it back.
  const deleteTimersRef = useRef(new Map<string, number>())

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
    // Skipped when the server already handed us the list.
    if (initialProfiles) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load, initialProfiles])

  // A pending deletion must still happen if the user navigates away before the
  // undo window closes — otherwise the row reappears on the next visit.
  // Mirrors ResumeCard's unmount handler.
  useEffect(() => {
    const timers = deleteTimersRef.current
    return () => {
      for (const [id, timer] of timers) {
        window.clearTimeout(timer)
        void fetch(`/api/jobsearch/profiles/${id}`, { method: 'DELETE' })
      }
      timers.clear()
    }
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

  async function scanNow(profile: ProfileSummary) {
    setError(null)
    setScanningId(profile._id)
    try {
      const res = await fetch('/api/jobsearch/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: profile._id }),
      })
      if (!res.ok) {
        setError('Could not start a scan. Please try again in a moment.')
        return
      }
      toast.success(`Scanned "${profile.name}"`)
      await load()
    } catch {
      setError('An error occurred. Please check your connection and try again.')
    } finally {
      setScanningId(null)
    }
  }

  // Optimistic delete with a 6s undo window, replacing the window.confirm()
  // this used to open — the same treatment deleting a résumé already gets.
  function deleteProfile(profile: ProfileSummary) {
    setError(null)
    setProfiles((prev) => (prev ? prev.filter((p) => p._id !== profile._id) : prev))

    const commit = () => {
      deleteTimersRef.current.delete(profile._id)
      void (async () => {
        try {
          const res = await fetch(`/api/jobsearch/profiles/${profile._id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Delete failed')
        } catch {
          toast.error(`Could not delete "${profile.name}". It has been restored.`)
          await load()
        }
      })()
    }

    const timer = window.setTimeout(commit, UNDO_DELETE_DURATION)
    deleteTimersRef.current.set(profile._id, timer)

    const toastId = toast.withAction(`Deleted "${profile.name}"`, 'Undo', () => {
      const pending = deleteTimersRef.current.get(profile._id)
      if (pending !== undefined) {
        window.clearTimeout(pending)
        deleteTimersRef.current.delete(profile._id)
      }
      void load()
    })
    // Keep the toast alive no longer than the window it describes.
    window.setTimeout(() => useToastStore.getState().dismiss(toastId), UNDO_DELETE_DURATION)
  }

  // Only fully replace the view with an error screen when the very first load
  // failed and there's nothing to show yet. Once profiles have loaded
  // successfully, a later failed reload/toggle shows an inline banner above
  // the still-intact list instead — mirrors ProfileWizard's error convention.
  if (error && profiles === null) {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <ErrorBanner>{error}</ErrorBanner>
        <Button size="md" onClick={() => load()}>
          Try again
        </Button>
      </div>
    )
  }

  if (profiles === null) return null

  const errorBanner = error ? <ErrorBanner>{error}</ErrorBanner> : null

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
        <Card
          tone="outline"
          padding="lg"
          className="flex flex-col items-center gap-2 border-dashed py-10 text-center"
        >
          <p className="font-semibold text-fg-heading">No profiles yet</p>
          <p className="max-w-sm text-sm text-fg-subtle">
            A profile describes the roles you want. It polls the job boards you pick on a
            schedule, and your rules decide which results reach you.
          </p>
          <Button size="md" className="mt-2" onClick={() => setShowWizard(true)}>
            Create a profile
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {errorBanner}
      <div className="flex justify-end">
        <Button size="md" onClick={() => setShowWizard(true)}>
          Create profile
        </Button>
      </div>

      <ul aria-live="polite" className="flex flex-col gap-2">
        {profiles.map((profile) => {
          const chips = watchChips(profile)
          const isScanning = scanningId === profile._id
          return (
            <li key={profile._id}>
              <Card
                className={`flex flex-col gap-2.5 transition ${
                  profile.isActive ? 'hover:border-input' : 'opacity-70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        profile.isActive ? 'bg-success-500' : 'bg-neutral-400'
                      }`}
                    />
                    <Link
                      href={`/dashboard/jobsearch/${profile._id}`}
                      className="truncate font-semibold text-fg-body hover:underline"
                    >
                      {profile.name}
                    </Link>
                    {!profile.isActive && <Badge tone="neutral">Paused</Badge>}
                  </div>

                  <div className="flex items-center gap-3.5">
                    {profile.isActive && (
                      <>
                        <Metric value={profile.newMatchCount ?? 0} label="new" />
                        <Metric value={profile.queuedCount ?? 0} label="queued" />
                      </>
                    )}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={profile.isActive}
                      aria-label="Active"
                      onClick={() => toggleActive(profile)}
                      className={`relative h-[18px] w-8 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-surface-page ${
                        profile.isActive ? 'bg-primary' : 'bg-accent-200'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${
                          profile.isActive ? 'left-[16px]' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {chips.map((chip) => (
                      <Badge key={chip.key} tone={chip.tone}>
                        {chip.label}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-2.5">
                  <span className="text-xs text-fg-subtle">
                    {profile.updatedAt ? `Updated ${formatRelativeTime(profile.updatedAt)}` : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      disabled={isScanning || !profile.isActive}
                      onClick={() => scanNow(profile)}
                    >
                      <Search aria-hidden="true" className="h-3 w-3" />
                      {isScanning ? 'Scanning…' : 'Scan now'}
                    </Button>
                    <Link
                      href={`/dashboard/jobsearch/${profile._id}`}
                      className={buttonClasses({ variant: 'secondary', size: 'xs' })}
                    >
                      Open
                    </Link>
                    <Menu
                      open={menuOpenId === profile._id}
                      onOpenChange={(open) => setMenuOpenId(open ? profile._id : null)}
                    >
                      <MenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`More actions for ${profile.name}`}
                        >
                          <MoreVertical aria-hidden="true" className="h-3.5 w-3.5" />
                        </Button>
                      </MenuTrigger>
                      <MenuContent className="w-40 p-1.5">
                        <MenuItem
                          className="text-fg-danger hover:bg-surface-danger data-[highlighted]:bg-surface-danger"
                          onSelect={() => deleteProfile(profile)}
                        >
                          <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                          Delete profile
                        </MenuItem>
                      </MenuContent>
                    </Menu>
                  </div>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
