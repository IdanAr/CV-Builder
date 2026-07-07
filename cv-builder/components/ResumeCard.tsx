'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import type { ApplicationStatus } from '@/lib/schemas/resume.zod'

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
    applicationStatus: ApplicationStatus
    targetCompany?: string
    targetRole?: string
    parentResumeTitle?: string
    createdAt: string
    updatedAt: string
  }
}

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: 'Draft',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
}

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  draft: 'bg-gray-100 text-gray-700 border-gray-300',
  applied: 'bg-blue-100 text-blue-700 border-blue-300',
  interviewing: 'bg-amber-100 text-amber-800 border-amber-300',
  offer: 'bg-green-100 text-green-700 border-green-300',
  rejected: 'bg-red-100 text-red-700 border-red-300',
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
  const [status, setStatus] = useState<ApplicationStatus>(resume.applicationStatus)
  const deleteTimerRef = useRef<number | null>(null)
  const undoToastIdRef = useRef<number | null>(null)

  useEffect(() => {
    setStatus(resume.applicationStatus)
  }, [resume.applicationStatus])

  async function handleStatusChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const previous = status
    const next = e.target.value as ApplicationStatus
    setStatus(next)
    try {
      const res = await fetch(`/api/resumes/${resume._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationStatus: next }),
      })
      if (!res.ok) throw new Error('Update failed')
      router.refresh()
    } catch (err) {
      console.error(err)
      setStatus(previous)
      toast.error(`Could not update status for "${resume.title}". Please try again.`)
    }
  }

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

  function handleDelete() {
    setPendingDelete(true)
    undoToastIdRef.current = toast.withAction(
      `Deleted "${resume.title}"`,
      'Undo',
      () => {
        if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current)
        deleteTimerRef.current = null
        setPendingDelete(false)
      }
    )
    deleteTimerRef.current = window.setTimeout(() => {
      deleteTimerRef.current = null
      if (undoToastIdRef.current !== null) useToastStore.getState().dismiss(undoToastIdRef.current)
      void commitDelete()
    }, 6000)
  }

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
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold text-indigo-900">{resume.title}</p>
            {resume.parentResumeTitle && (
              <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-500">
                ↳ Version of &quot;{resume.parentResumeTitle}&quot;
              </span>
            )}
          </div>
          <p className="truncate text-sm text-indigo-400">
            {resume.data.basics?.label ?? 'No role set'} · {resume.meta.templateId ?? 'classic'} template
          </p>
        </div>

        {/* Added 'relative z-10' to lift these buttons above the invisible link */}
        <div className="relative z-10 flex shrink-0 items-center gap-2">
          <select
            value={status}
            onChange={handleStatusChange}
            aria-label={`Application status for ${resume.title}`}
            className={`rounded-md border px-2 py-1.5 text-xs font-medium ${STATUS_STYLES[status]}`}
          >
            {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>

          <span
            className="rounded-md border border-indigo-300 bg-white/50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition group-hover:bg-indigo-50 pointer-events-none"
          >
            Open
          </span>

          <button
            onClick={handleDownload}
            className="rounded-md border border-indigo-100 bg-white px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
            title="Download as JSON"
          >
            ↓ JSON
          </button>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
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

      {(resume.targetCompany || resume.targetRole) && (
        <p
          data-testid="target-company-role"
          className="mt-2 truncate text-sm text-indigo-600 relative z-10 pointer-events-none"
        >
          {[resume.targetCompany, resume.targetRole].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}