'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

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
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  async function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/resumes/${resume._id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setConfirmingDelete(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      setConfirmingDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/resumes/${resume._id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Duplicate failed')
      router.refresh()
    } catch (err) {
      console.error(err)
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
    }
  }

  return (
    <div className="rounded-xl border border-white/30 bg-white/65 backdrop-blur-xl p-4 shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-indigo-900">{resume.title}</p>
          <p className="truncate text-sm text-indigo-400">
            {resume.data.basics?.label ?? 'No role set'} · {resume.meta.templateId ?? 'classic'} template
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/dashboard/resumes/${resume._id}`}
            className="rounded-md border border-indigo-300 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
          >
            Open
          </Link>
          <button
            onClick={handleDownload}
            className="rounded-md border border-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
            title="Download as JSON"
          >
            ↓ JSON
          </button>
          <button
            onClick={handleDuplicate}
            disabled={duplicating}
            className="rounded-md border border-indigo-100 px-3 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
            title="Duplicate"
          >
            {duplicating ? '…' : '⧉'}
          </button>
          {confirmingDelete ? (
            <span className="flex items-center gap-1">
              <span className="text-xs font-medium text-red-600">Sure?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-md border border-red-500 bg-red-50 px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-100 disabled:opacity-50"
              >
                {deleting ? '…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md border border-indigo-100 px-2 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50"
              >
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              title="Delete"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Metadata row */}
      <div className="mt-3 flex flex-wrap gap-6 border-t border-indigo-100 pt-3">
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
