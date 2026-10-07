'use client'
import { cn } from '@/lib/utils'
import { handleTablistKeyDown, tabIndexFor } from '@/lib/tablist-keys'

export type WizardStep = 1 | 2 | 3

const STEP_LABELS: Record<WizardStep, string> = {
  1: 'Job Description & Score',
  2: 'Close the Gap',
  3: 'Review & Apply',
}

interface StepsBarProps {
  current: WizardStep
  maxUnlocked: WizardStep
  onStepClick: (step: WizardStep) => void
}

const STEPS: WizardStep[] = [1, 2, 3]

export function StepsBar({ current, maxUnlocked, onStepClick }: StepsBarProps) {
  return (
    <div
      className="flex gap-1 rounded-full bg-surface-subtle p-1"
      role="tablist"
      aria-label="ATS analysis steps"
      onKeyDown={handleTablistKeyDown}
    >
      {STEPS.map((step) => {
        const isCurrent = step === current
        const isLocked = step > maxUnlocked
        const isDone = !isCurrent && !isLocked

        const buttonClass = cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium transition-colors min-h-10',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isCurrent
            ? 'bg-primary text-primary-fg'
            : isDone
            ? 'bg-surface-success text-fg-success hover:bg-surface-subtle'
            : 'bg-surface-muted text-fg-muted cursor-not-allowed'
        )

        const badgeClass = cn(
          'flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
          isCurrent ? 'bg-primary-fg/25' : 'bg-surface/70'
        )

        return (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            aria-disabled={isLocked}
            tabIndex={tabIndexFor(isCurrent)}
            disabled={isLocked}
            onClick={() => onStepClick(step)}
            className={buttonClass}
          >
            <span className={badgeClass}>{isDone ? '✓' : step}</span>
            {STEP_LABELS[step]}
          </button>
        )
      })}
    </div>
  )
}
