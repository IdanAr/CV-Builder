'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Download, ClipboardList, Copy, X, MoreVertical } from 'lucide-react'
import { useResumeActions } from '@/components/cvs/use-resume-actions'
import { Popover } from '@/components/ui/Popover'
import { formatAbsoluteDate, formatRelativeTime } from '@/lib/format-relative-time'
import type { ResumeApplicationBadge } from '@/lib/applications/resume-status'

// Continuity with the pre-Task-46 "draft" visual: zero linked applications
// renders the same gray "Draft" pill it always has.
const DRAFT_BADGE = { label: 'Draft', color: '#94a3b8' }
// Neutral gray reused for the "N applications" count badge, matching draft's tone.
const MULTIPLE_BADGE_COLOR = '#94a3b8'

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
    parentResumeId?: string
    parentResumeTitle?: string
  }
  applicationBadge: ResumeApplicationBadge
}

const formatDate = formatAbsoluteDate

export default function ResumeCard({ resume, applicationBadge }: ResumeCardProps) {
  const actions = useResumeActions({ id: resume._id, title: resume.title })
  const [menuOpen, setMenuOpen] = useState(false)

  if (actions.hidden) return null

  const statusOption =
    applicationBadge.kind === 'single'
      ? { label: applicationBadge.label, color: applicationBadge.color }
      : applicationBadge.kind === 'multiple'
      ? { label: `${applicationBadge.count} applications`, color: MULTIPLE_BADGE_COLOR }
      : DRAFT_BADGE

  return (
    <div className="relative group rounded-xl border border-border-subtle bg-surface p-4 shadow-lg hover:border-accent-300 hover:shadow-xl transition-all">
      {/* The invisible link that covers the whole card */}
      <Link href={`/dashboard/resumes/${resume._id}`} className="absolute inset-0 z-0" aria-label={`Open ${resume.title}`} />

      <div className="flex items-start justify-between gap-4">
        {/* Added 'relative z-10' to text so it stays selectable above the link */}
        <div className="min-w-0 relative z-10 pointer-events-none">
          <p className="truncate font-semibold text-fg-heading">{resume.title}</p>
          <p className="truncate text-sm text-fg-muted">
            {resume.data.basics?.label ?? 'No role set'} · {resume.meta.templateId ?? 'classic'} template
          </p>
          {resume.parentResumeId && resume.parentResumeTitle && (
            <Link
              href={`/dashboard/resumes/${resume.parentResumeId}`}
              className="pointer-events-auto mt-0.5 inline-block truncate text-xs text-fg-muted hover:text-fg-body hover:underline"
            >
              Based on: {resume.parentResumeTitle}
            </Link>
          )}
        </div>
        
        {/* Added 'relative z-10' to lift these buttons above the invisible link.
            'flex-wrap' lets buttons wrap onto a second line on narrow viewports
            instead of compressing against the truncated title/role text. */}
        <div className="relative z-10 flex min-w-0 flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">

          <Link
            href={`/dashboard/resumes/${resume._id}`}
            aria-label={`Open ${resume.title}`}
            className="rounded-md border border-accent-300 bg-surface px-3 py-1.5 text-xs font-medium text-accent-700 transition group-hover:bg-accent-50"
          >
            Open
          </Link>
          
          <button
            onClick={actions.download}
            disabled={actions.downloading}
            aria-label={`Download "${resume.title}" as JSON`}
            className="rounded-md border border-accent-100 bg-white px-3 py-1.5 text-xs font-medium text-accent-700 transition hover:bg-accent-50 disabled:opacity-50"
            title="Download as JSON"
          >
            {actions.downloading ? '…' : (
              <span className="inline-flex items-center gap-1">
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                JSON
              </span>
            )}
          </button>
          <button
            onClick={actions.track}
            disabled={actions.tracking}
            aria-label={`Track an application using "${resume.title}"`}
            className="rounded-md border border-accent-100 bg-white px-3 py-1.5 text-xs font-medium text-accent-700 transition hover:bg-accent-50 disabled:opacity-50"
            title="Track application"
          >
            {actions.tracking ? '…' : (
              <span className="inline-flex items-center gap-1">
                <ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />
                Track
              </span>
            )}
          </button>
          <button
            onClick={actions.duplicate}
            disabled={actions.duplicating}
            aria-label={`Duplicate "${resume.title}"`}
            className="rounded-md border border-accent-100 bg-white px-3 py-1.5 text-xs font-medium text-accent-700 transition hover:bg-accent-50 disabled:opacity-50"
            title="Duplicate"
          >
            {actions.duplicating ? '…' : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          <Popover
            open={menuOpen}
            onOpenChange={setMenuOpen}
            trigger={
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label={`More actions for "${resume.title}"`}
                className="rounded-md border border-accent-100 bg-white px-2 py-1.5 text-accent-700 transition hover:bg-accent-50"
                title="More actions"
              >
                <MoreVertical className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            }
          >
            <div
              role="menu"
              className="w-36 overflow-hidden rounded-xl border border-border-subtle bg-surface shadow-xl"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  actions.remove()
                }}
                aria-label={`Delete ${resume.title}`}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-danger-600 transition-colors hover:bg-danger-50"
                title="Delete"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Delete
              </button>
            </div>
          </Popover>
        </div>
      </div>

      {/* Metadata row - pointer-events-none allows clicking through to the main card link */}
      <div className="mt-3 flex flex-wrap gap-6 border-t border-accent-100 pt-3 relative z-10 pointer-events-none">
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Status</p>
          <p className="mt-0.5">
            <span
              className="inline-flex max-w-full items-center truncate rounded-full px-2 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: statusOption.color }}
            >
              {statusOption.label}
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Created</p>
          <p className="mt-0.5 text-sm text-fg">{formatDate(resume.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Last Edited</p>
          <p className="mt-0.5 text-sm text-fg">{formatRelativeTime(resume.updatedAt)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Sections</p>
          <p className="mt-0.5 text-sm text-fg">{resume.sectionsFilledCount} filled</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Layout</p>
          <p className="mt-0.5 text-sm capitalize text-fg">
            {(resume.meta.layout ?? 'single-column').replace('-', ' ')}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Format Score</p>
          <p className={`mt-0.5 text-sm font-medium ${
            resume.formatScore >= 20
              ? 'text-success-600'
              : resume.formatScore >= 10
              ? 'text-warning-600'
              : 'text-fg-danger'
          }`}>
            {resume.formatScore}/25
          </p>
        </div>
      </div>
    </div>
  )
}