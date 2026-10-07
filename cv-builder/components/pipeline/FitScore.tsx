import { cn } from '@/lib/utils'

/** At or above this a match reads as worth acting on. */
export const STRONG_FIT = 80

/** The fit score as a bare number, coloured only when strong. */
export function FitScore({ score }: { score?: number }) {
  if (score === undefined) return null
  return (
    <>
      <span
        aria-hidden="true"
        className={cn('text-sm tabular-nums', score >= STRONG_FIT ? 'font-medium text-fg-success' : 'text-fg-body')}
      >
        {score}
      </span>
      <span className="sr-only">{score}% match</span>
    </>
  )
}
