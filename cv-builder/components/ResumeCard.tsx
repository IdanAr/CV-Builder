'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { onToastPause, onToastResume } from '@/components/ui/Toaster'

const UNDO_DELETE_DURATION = 6000

interface ResumeCardProps {
  resume: {
    _id: string
    title: string
    data: {
      basics?: { label?: string }
    }
    meta: {
      templateId?: string
      layout?: string
    }
    sectionsFilledCount: number
    formatScore: number
    createdAt: string
    updatedAt: string
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 7) return formatDate(iso)
  if (days > 1) return `${days} days ago`
  if (days === 1) return 'Yesterday'
  if (hours > 1) return `${hours} hours ago`
  if (hours === 1) return '1 hour ago'
  if (minutes > 1) return `${minutes} minutes ago`
  return 'Just now'
}

export default function ResumeCard({ resume }: ResumeCardProps) {
  const router = useRouter()
  const [duplicating, setDuplicating] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const deleteTimerRef = useRef<number | null>(null)
  const undoToastIdRef = useRef<number | null>(null)
  // Tracks the undo window's remaining time so a hover/focus pause on the
  // toast (see Toaster.tsx) can resume the countdown instead of resetting it.
  const remainingRef = useRef(UNDO_DELETE_DURATION)
  const startedAtRef = useRef(0)
  const cancelledRef = useRef(false)

  async function commitDelete() {
    try {
      const res = await fetch(`/api/resumes/${resume._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch (err) {
      console.error(err)
      setPendingDelete(false)
      toast.error(`Could not delete "${resume.title}". It has been restored.`)
    }
  }

  function startDeleteTimer(ms: number) {
    startedAtRef.current = Date.now()
    remainingRef.current = ms
    deleteTimerRef.current = window.setTimeout(() => {
      deleteTimerRef.current = null
      if (undoToastIdRef.current !== null) useToastStore.getState().dismiss(undoToastIdRef.current)
      void commitDelete()
    }, ms)
  }

  function pauseDeleteTimer() {
    if (deleteTimerRef.current === null) return
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
    window.clearTimeout(deleteTimerRef.current)
    deleteTimerRef.current = null
  }

  function resumeDeleteTimer() {
    if (deleteTimerRef.current !== null) return
    if (cancelledRef.current) return
    startDeleteTimer(remainingRef.current)
  }

  function handleDelete() {
    cancelledRef.current = false
    setPendingDelete(true)
    undoToastIdRef.current = toast.withAction(
      `Deleted "${resume.title}"`,
      'Undo',
      () => {
        cancelledRef.current = true
        if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current)
        deleteTimerRef.current = null
        setPendingDelete(false)
      }
    )
    startDeleteTimer(UNDO_DELETE_DURATION)
  }

  // Subscribe once to the Toaster's pause/resume bus so a hover or focus on
  // the undo-delete toast pauses this component's own deletion countdown
  // (the toast's own visual dismiss timer lives in Toaster.tsx and is paused
  // independently, in lockstep, via the same hover/focus interaction).
  useEffect(() => {
    const unsubPause = onToastPause((id) => {
      if (undoToastIdRef.current === id) pauseDeleteTimer()
    })
    const unsubResume = onToastResume((id) => {
      if (undoToastIdRef.current === id) resumeDeleteTimer()
    })
    return () => {
      unsubPause()
      unsubResume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        window.clearTimeout(deleteTimerRef.current)
        void fetch(`/api/resumes/${resume._id}`, { method: 'DELETE' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/resumes/${resume._id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Duplicate failed')
      toast.success(`Duplicated "${resume.title}"`)
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error(`Could not duplicate "${resume.title}". Please try again.`)
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(`/api/resumes/${resume._id}`)
      if (!res.ok) throw new Error('Fetch failed')
      const { resume: full } = await res.json()
      const blob = new Blob([JSON.stringify(full.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${resume.title}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      toast.error(`Could not download "${resume.title}" as JSON. Please try again.`)
    }
  }

  if (pendingDelete) return null

  return (
    <div className="relative group rounded-xl border border-white/30 bg-white/65 backdrop-blur-xl p-4 shadow-lg hover:border-indigo-300 hover:shadow-xl transition-all">
      {/* The invisible link that covers the whole card */}
      <Link href={`/dashboard/resumes/${resume._id}`} className="absolute inset-0 z-0" aria-label={`Open ${resume.title}`} />

      <div className="flex items-start justify-between gap-4">
        {/* Added 'relative z-10' to text so it stays selectable above the link */}
        <div className="min-w-0 relative z-10 pointer-events-none">
          <p className="truncate font-semibold text-indigo-900">{resume.title}</p>
          <p className="truncate text-sm text-indigo-400">
            {resume.data.basics?.label ?? 'No role set'} · {resume.meta.templateId ?? 'classic'} template
          </p>
        </div>
        
        {/* Added 'relative z-10' to lift these buttons above the invisible link */}
        <div className="relative z-10 flex shrink-0 gap-2">
          
          <span
            className="rounded-md border border-indigo-300 bg-white/50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition group-hover:bg-indigo-50 pointer-events-none"
          >
            Open
          </span>
          
          <button
            onClick={handleDownload}
            aria-label={`Download "${resume.title}" as JSON`}
            className="rounded-md border border-indigo-100 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
            title="Download as JSON"
          >
            ↓ JSON
          </button>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            aria-label={`Duplicate "${resume.title}"`}
            className="rounded-md border border-indigo-100 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
            title="Duplicate"
          >
            {duplicating ? '…' : '⧉'}
          </button>
          <button
            onClick={handleDelete}
            aria-label={`Delete ${resume.title}`}
            className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Metadata row - pointer-events-none allows clicking through to the main card link */}
      <div className="mt-3 flex flex-wrap gap-6 border-t border-indigo-100 pt-3 relative z-10 pointer-events-none">
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Created</p>
          <p className="mt-0.5 text-sm text-indigo-900">{formatDate(resume.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Last Edited</p>
          <p className="mt-0.5 text-sm text-indigo-900">{formatRelativeTime(resume.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Sections</p>
          <p className="mt-0.5 text-sm text-indigo-900">{resume.sectionsFilledCount} filled</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Layout</p>
          <p className="mt-0.5 text-sm capitalize text-indigo-900">
            {(resume.meta.layout ?? 'single-column').replace('-', ' ')}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-indigo-400">Format Score</p>
          <p className={`mt-0.5 text-sm font-medium ${
            resume.formatScore >= 20
              ? 'text-green-600'
              : resume.formatScore >= 10
              ? 'text-yellow-600'
              : 'text-red-500'
          }`}>
            {resume.formatScore}/25
          </p>
        </div>
      </div>
    </div>
  )
}