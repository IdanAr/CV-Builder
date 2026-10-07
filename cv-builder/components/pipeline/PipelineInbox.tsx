'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { planActions, isOneStep } from '@/lib/jobsearch/job-actions'
import { parsePipelineView, pipelineHref, type PipelineView } from '@/lib/jobsearch/pipeline-url'
import type { PipelineFilter } from '@/lib/jobsearch/stages'
import { notifyScrapedJobsChanged } from '@/lib/stores/scraped-jobs.store'
import { toast } from '@/lib/stores/toast.store'
import { JobDetail } from './JobDetail'
import { PipelineFilters, type ProfileOption } from './PipelineFilters'
import { PipelineList } from './PipelineList'
import { ShortcutsHelp } from './ShortcutsHelp'
import { StageTabs } from './StageTabs'
import { usePipelineActions } from './use-pipeline-actions'
import { usePipelineJobs, type PipelineInitial } from './use-pipeline-jobs'
import { usePipelineShortcuts } from './use-pipeline-shortcuts'

export interface PipelineInboxProps {
  initial: PipelineInitial
  profiles: ProfileOption[]
}

const SOURCES_HREF = '/dashboard/jobsearch/sources'
const QUERY_DEBOUNCE_MS = 250
const RATE_LIMIT_MESSAGE = 'Too many scans. Wait a minute and try again.'
const SCAN_FAILED = 'Scan failed. Please try again.'

type ScanOutcome = 'ok' | 'limited' | 'failed'

/** POSTs one scan. Surfaces its own failures as toasts; the caller only needs to know whether to continue. */
async function scanProfile(profileId: string): Promise<ScanOutcome> {
  try {
    const res = await fetch('/api/jobsearch/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId }),
    })
    if (res.status === 429) {
      toast.error(RATE_LIMIT_MESSAGE)
      return 'limited'
    }
    const body = (await res.json().catch(() => ({}))) as {
      result?: { degraded?: boolean; errorMessage?: string }
    }
    if (body.result?.degraded) {
      toast.error(body.result.errorMessage ?? SCAN_FAILED)
      return 'failed'
    }
    if (!res.ok) {
      toast.error(SCAN_FAILED)
      return 'failed'
    }
    return 'ok'
  } catch {
    toast.error(SCAN_FAILED)
    return 'failed'
  }
}

export function PipelineInbox({ initial, profiles }: PipelineInboxProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = parsePipelineView(searchParams, initial.view.stage)

  const jobs = usePipelineJobs(view, initial)
  const actions = usePipelineActions({
    removeLocal: jobs.removeLocal,
    reload: jobs.reload,
    navigate: router.push,
  })

  const { clearError } = actions
  // A banner for a failed action belongs to the view it happened in.
  useEffect(() => {
    clearError()
  }, [view.stage, view.profile, view.q, view.job, clearError])

  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  })

  /** The one place the URL is written (R8). Changing stage, profile or q clears the selection. */
  const setView = useCallback(
    (patch: Partial<PipelineView>) => {
      const next = { ...viewRef.current, ...patch }
      if (!('job' in patch) && ('stage' in patch || 'profile' in patch || 'q' in patch)) next.job = null
      // Native history call: Next syncs useSearchParams with it and, unlike
      // router.replace, makes no server request to re-render the dynamic page.
      window.history.replaceState(null, '', pipelineHref(next))
    },
    []
  )

  // Search: controlled locally, pushed to the URL after a pause.
  const [query, setQuery] = useState(view.q)
  const queryTimerRef = useRef<number | null>(null)
  const onQueryChange = useCallback(
    (q: string) => {
      setQuery(q)
      if (queryTimerRef.current !== null) window.clearTimeout(queryTimerRef.current)
      queryTimerRef.current = window.setTimeout(() => {
        queryTimerRef.current = null
        setView({ q })
      }, QUERY_DEBOUNCE_MS)
    },
    [setView]
  )
  useEffect(
    () => () => {
      if (queryTimerRef.current !== null) window.clearTimeout(queryTimerRef.current)
    },
    []
  )
  // Follow the URL when it changes elsewhere (back/forward), but never fight typing.
  useEffect(() => {
    // pipelineHref trims q, so compare ignoring trim or a trailing space would be eaten.
    if (queryTimerRef.current === null) setQuery((prev) => (prev.trim() === view.q ? prev : view.q))
  }, [view.q])

  const selected = jobs.items.find((j) => j._id === view.job) ?? null

  // R8: a ?job= that is not in the loaded items is stale; drop it.
  useEffect(() => {
    if (view.job && jobs.status === 'ready' && !jobs.items.some((j) => j._id === view.job)) {
      setView({ job: null })
    }
  }, [view.job, jobs.status, jobs.items, setView])

  const detailRef = useRef<HTMLDivElement>(null)
  const itemsRef = useRef(jobs.items)
  const selectedRef = useRef(selected)
  useEffect(() => {
    itemsRef.current = jobs.items
    selectedRef.current = selected
  })

  usePipelineShortcuts(
    {
      move(delta) {
        const items = itemsRef.current
        if (items.length === 0) return
        const idx = items.findIndex((j) => j._id === selectedRef.current?._id)
        const next = idx < 0 ? 0 : Math.min(items.length - 1, Math.max(0, idx + delta))
        setView({ job: items[next]._id })
      },
      openSelected() {
        if (!selectedRef.current) {
          const first = itemsRef.current[0]
          if (first) setView({ job: first._id })
          return
        }
        detailRef.current?.querySelector<HTMLElement>('[data-job-detail-heading]')?.focus()
      },
      runPrimary() {
        const job = selectedRef.current
        if (!job || actions.busyId) return
        const { primary } = planActions(job)
        if (primary && isOneStep(primary)) actions.run(primary, job)
      },
      dismissSelected() {
        const job = selectedRef.current
        if (!job || actions.busyId) return
        if (planActions(job).secondary.includes('dismiss')) actions.run('dismiss', job)
      },
    },
    profiles.length > 0
  )

  // Scan (R9).
  const [scanning, setScanning] = useState(false)
  const activeProfiles = profiles.filter((p) => p.isActive)
  const canScan = Boolean(view.profile) || activeProfiles.length > 0
  const onScan = useCallback(async () => {
    setScanning(true)
    try {
      const targets = view.profile ? [view.profile] : activeProfiles.map((p) => p._id)
      for (const id of targets) {
        const outcome = await scanProfile(id)
        if (outcome === 'limited') break
      }
      notifyScrapedJobsChanged()
    } finally {
      setScanning(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view.profile, profiles])

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold text-fg-body">Job search</h1>
      <Link
        href={SOURCES_HREF}
        className="inline-flex min-h-10 items-center rounded-md px-2 text-sm text-fg-muted underline-offset-4 hover:text-fg-body hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
      >
        Sources and rules
      </Link>
    </div>
  )

  if (profiles.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <Card tone="outline" padding="lg" className="text-center">
          <p className="text-sm text-fg-body">Set up a profile to start finding jobs.</p>
          <Link href={SOURCES_HREF} className="mt-3 inline-block text-sm text-fg-body underline underline-offset-4">
            Go to Sources and rules
          </Link>
        </Card>
      </div>
    )
  }

  // PipelineList only shows an error when it has no rows; with rows, say so here.
  const bannerError = actions.error ?? (jobs.items.length > 0 ? jobs.error : null)
  const hasFilters = Boolean(view.profile || view.q.trim())

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-fg-body">Job search</h1>
        <div className="flex items-center gap-1">
          <ShortcutsHelp />
          <Link
            href={SOURCES_HREF}
            className="inline-flex min-h-10 items-center rounded-md px-2 text-sm text-fg-muted underline-offset-4 hover:text-fg-body hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-8"
          >
            Sources and rules
          </Link>
        </div>
      </div>

      <StageTabs active={view.stage} counts={jobs.counts} onSelect={(stage: PipelineFilter) => setView({ stage })} />

      <PipelineFilters
        profiles={profiles}
        profile={view.profile}
        q={query}
        onProfileChange={(profile) => setView({ profile })}
        onQueryChange={onQueryChange}
        scanning={scanning}
        onScan={() => void onScan()}
        scanLabel={view.profile ? 'Scan now' : 'Scan all'}
        hideScan={!canScan}
      />

      {!canScan && (
        <p className="text-sm text-fg-muted">
          No profile is active, so there is nothing to scan.{' '}
          <Link href={SOURCES_HREF} className="text-fg-body underline underline-offset-4">
            Set up a profile
          </Link>
        </p>
      )}

      {bannerError && (
        <ErrorBanner>
          {bannerError}
          {!actions.error && (
            <>
              {' '}
              <button
                type="button"
                onClick={() => void jobs.reload()}
                className="underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try again
              </button>
            </>
          )}
        </ErrorBanner>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
        <div data-pipeline-list="" className={view.job ? 'hidden min-w-0 lg:block' : 'block min-w-0'}>
          <PipelineList
            stage={view.stage}
            status={jobs.status}
            items={jobs.items}
            selectedId={view.job}
            unreadIds={jobs.unreadIds}
            nextCursor={jobs.nextCursor}
            loadingMore={jobs.loadingMore}
            hasFilters={hasFilters}
            error={jobs.error}
            onSelect={(id) => setView({ job: id })}
            onLoadMore={() => void jobs.loadMore()}
            onRetry={() => void jobs.reload()}
          />
        </div>
        <div ref={detailRef} data-pipeline-detail="" className={view.job ? 'block min-w-0' : 'hidden min-w-0 lg:block'}>
          <JobDetail
            job={selected}
            busy={actions.busyId !== null}
            onAction={actions.run}
            onBack={() => setView({ job: null })}
          />
        </div>
      </div>
    </div>
  )
}
