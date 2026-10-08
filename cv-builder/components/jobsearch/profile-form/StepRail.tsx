'use client'

import { cn } from '@/lib/utils'

export interface StepRailProps {
  steps: readonly string[]
  current: number
  maxUnlocked: number
  onStepClick: (step: number) => void
}

/**
 * Progress rail for the funnel. From `sm` up it is a row of labelled segments;
 * on a phone the labels would not fit, so it shows one "Step n of N: Label"
 * line above the same segments (still tappable, 40px tall).
 */
export function StepRail({ steps, current, maxUnlocked, onStepClick }: StepRailProps) {
  return (
    <nav aria-label="Profile setup steps" className="flex flex-col gap-2">
      <p className="text-sm font-medium text-fg-heading sm:hidden">
        Step {current + 1} of {steps.length}: {steps[current]}
      </p>
      <ol className="flex gap-1.5">
        {steps.map((label, index) => {
          const locked = index > maxUnlocked
          const isCurrent = index === current
          return (
            <li key={label} className="flex-1">
              <button
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${index + 1}. ${label}`}
                disabled={locked}
                onClick={() => onStepClick(index)}
                className={cn(
                  'flex w-full flex-col gap-1.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10 max-sm:justify-center',
                  isCurrent ? 'font-medium text-fg-heading' : locked ? 'cursor-not-allowed text-fg-subtle' : 'text-fg-muted hover:text-fg-body'
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn('h-1 w-full rounded-chip', index <= maxUnlocked ? 'bg-primary' : 'bg-border')}
                />
                <span className="max-sm:sr-only">
                  {index + 1}. {label}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
