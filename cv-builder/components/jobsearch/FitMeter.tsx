import { cn } from '@/lib/utils'

/**
 * The ATS fit score, as a number, a three-segment bar and a colour band.
 *
 * Deliberately small: a large ring or donut would out-shout the job title,
 * which is the thing people actually click. Shared by every surface that
 * ranks postings — the matches feed, the scraped-jobs list and the draft
 * queue — so a score means the same thing everywhere.
 */

/** Above this a match reads as worth acting on without qualification. */
export const STRONG_FIT = 80
/** Below this the primary action is withheld rather than disabled. */
export const FAIR_FIT = 70

export function fitBand(score: number): { text: string; bar: string; filled: number } {
  if (score >= 85) return { text: 'text-fg-success', bar: 'bg-success-500', filled: 3 }
  if (score >= FAIR_FIT) return { text: 'text-fg-body', bar: 'bg-accent-500', filled: 2 }
  return { text: 'text-fg-warning', bar: 'bg-warning-500', filled: 1 }
}

export function FitMeter({ score, className }: { score: number; className?: string }) {
  const band = fitBand(score)
  return (
    <div className={cn('flex w-11 shrink-0 flex-col items-center gap-1.5', className)}>
      <span className={cn('text-lg font-bold leading-none tabular-nums tracking-tight', band.text)}>
        {score}
      </span>
      <span aria-hidden="true" className="flex w-full gap-0.5">
        {[0, 1, 2].map((i) => (
          <i
            key={i}
            className={cn('h-[3px] flex-1 rounded-sm', i < band.filled ? band.bar : 'bg-secondary')}
          />
        ))}
      </span>
      <span className="text-[9px] uppercase tracking-wider text-fg-subtle">fit</span>
      <span className="sr-only">{score}% match</span>
    </div>
  )
}
