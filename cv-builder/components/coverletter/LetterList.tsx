'use client'

import { useId } from 'react'
import { ChevronRight, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
// Types only: the values would drag mongoose into the client bundle.
import type { CoverLetterView, SuggestedPosting } from '@/lib/api/cover-letters'
import { LEGACY_PLACEHOLDER } from '@/lib/coverletter/header'

/** Dates arrive over JSON as ISO strings, whatever the type says, so always go through `new Date`. */
export function letterDate(value: Date | string): string {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

/** The company, or '' for a migrated letter that never had one. */
export function letterCompany(letter: Pick<CoverLetterView, 'company' | 'legacy'>): string {
  return letter.legacy && letter.company === LEGACY_PLACEHOLDER ? '' : letter.company
}

export function letterTitle(letter: Pick<CoverLetterView, 'company' | 'role'> & { legacy?: boolean }): string {
  if (!letter.legacy) return `${letter.role} at ${letter.company}`
  const role = letter.role === LEGACY_PLACEHOLDER ? '' : letter.role
  const company = letterCompany(letter)
  if (role && company) return `${role} at ${company}`
  return role || company ? `Earlier letter: ${role || company}` : 'Earlier letter'
}

function LetterStatus({ letter }: { letter: CoverLetterView }) {
  if (letter.status === 'writing') return <Badge tone="accent">Writing</Badge>
  if (letter.status === 'failed') return <Badge tone="danger">Failed</Badge>
  if (letter.pendingApprovals.length > 0) return <Badge tone="attention">Check details</Badge>
  return null
}

/**
 * The CV's letters, newest first, each opening its own editor. A suggested
 * posting (from the job search) sits on top as a one-click start, which only
 * fills the form: nothing is written until the user presses Write.
 */
export function LetterList({
  letters,
  suggestion,
  onOpen,
  onNew,
  onSuggestion,
  onDelete,
}: {
  letters: CoverLetterView[]
  suggestion: SuggestedPosting | null
  onOpen: (id: string) => void
  onNew: () => void
  onSuggestion: () => void
  onDelete: (letter: CoverLetterView) => void
}) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-base font-medium text-fg-heading">Cover letters</h2>
          <p className="mt-0.5 text-sm text-fg-muted">One letter per job, written from the facts in this CV.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onNew}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          New letter
        </Button>
      </div>

      {suggestion && (
        <Button size="md" variant="soft" onClick={onSuggestion} className="w-full whitespace-normal text-left">
          <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />
          {`Write a letter for ${letterTitle(suggestion)}`}
        </Button>
      )}

      {letters.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-4 py-6 text-center text-sm text-fg-muted">
          No letters for this CV yet.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface">
          {letters.map((letter) => (
            <li key={letter.id} className="flex items-center gap-1 pr-2">
              <button
                type="button"
                onClick={() => onOpen(letter.id)}
                className="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg-heading">{letterTitle(letter)}</span>
                  <span className="mt-0.5 flex items-center gap-2 text-xs text-fg-muted">
                    {letterDate(letter.createdAt)}
                    <LetterStatus letter={letter} />
                  </span>
                </span>
                <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-fg-subtle" />
              </button>
              <Button
                size="icon"
                variant="dangerGhost"
                aria-label={`Delete letter for ${letterTitle(letter)}`}
                title="Delete letter"
                onClick={() => onDelete(letter)}
              >
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
