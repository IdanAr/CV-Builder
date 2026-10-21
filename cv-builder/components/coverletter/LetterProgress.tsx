'use client'

import { Loader2 } from 'lucide-react'
// Types only: the values would drag mongoose into the client bundle.
import type { CoverLetterView } from '@/lib/api/cover-letters'

type Step = NonNullable<CoverLetterView['progress']>

const STEP_TEXT: Record<Step, string> = {
  reading: 'Reading the posting',
  planning: 'Planning the letter',
  writing: 'Writing',
  critiquing: 'Checking it like an editor',
  checking: 'Checking the facts',
  refining: 'Fixing flagged sentences',
  done: 'Finishing up',
}

/** What the background job is doing right now, from the letter record's `progress` step. */
export function progressText(progress: CoverLetterView['progress']): string {
  return progress ? STEP_TEXT[progress] : 'Starting the letter'
}

/**
 * Stands in for the editor while a letter is being written. The step text is
 * a polite live region, so a screen reader hears each step as the poll
 * brings it in without being interrupted mid-sentence.
 */
export function LetterProgress({ progress }: { progress: CoverLetterView['progress'] }) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center gap-2 rounded-card border border-border bg-surface px-4 py-6 text-center">
      <Loader2 aria-hidden="true" className="h-5 w-5 text-primary motion-safe:animate-spin" />
      <p role="status" aria-live="polite" className="text-sm text-fg-body">
        {progressText(progress)}
      </p>
      <p className="text-xs text-fg-muted">Usually under a minute. The letter keeps writing if you leave this tab.</p>
    </div>
  )
}
