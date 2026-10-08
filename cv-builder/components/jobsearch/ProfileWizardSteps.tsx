'use client'
import { handleTablistKeyDown, tabIndexFor } from '@/lib/tablist-keys'

interface ProfileWizardStepsProps {
  current: number
  maxUnlocked: number
  labels: string[]
  onStepClick: (step: number) => void
}

export function ProfileWizardSteps({ current, maxUnlocked, labels, onStepClick }: ProfileWizardStepsProps) {
  return (
    <div
      // Six steps of `flex-1` buttons overflow a phone: a flex item's default
      // `min-width: auto` stops it shrinking below its own content, so the six
      // badge-plus-label buttons demanded ~565px inside a 375px viewport and
      // steps 5 (Threshold) and 6 (Review) sat entirely off-screen — the last
      // two steps of the wizard, submit included, simply unreachable. Wrapping
      // below `sm` lays them out 3-per-row with every label still readable;
      // `sm:flex-nowrap` keeps the single row everywhere there is room for it.
      className="flex flex-wrap sm:flex-nowrap bg-surface-subtle rounded-card sm:rounded-full p-1 gap-1"
      role="tablist"
      aria-label="Job search profile setup steps"
      onKeyDown={handleTablistKeyDown}
    >
      {labels.map((label, index) => {
        const step = index + 1
        const isCurrent = step === current
        const isLocked = step > maxUnlocked
        const isDone = !isCurrent && !isLocked

        const buttonClass = isCurrent
          ? 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium bg-primary text-primary-fg transition-colors'
          : isDone
          ? 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-fg-body hover:bg-surface-selected transition-colors'
          : 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-fg-subtle cursor-not-allowed'

        const badgeClass = isCurrent
          ? 'flex items-center justify-center h-5 w-5 rounded-full bg-primary-fg/25 text-xs'
          : isDone
          ? 'flex items-center justify-center h-5 w-5 rounded-full bg-surface-selected text-xs'
          : 'flex items-center justify-center h-5 w-5 rounded-full bg-surface-subtle text-xs'

        return (
          <button
            key={label}
            type="button"
            role="tab"
            id={`wizard-tab-${step}`}
            aria-controls={`wizard-panel-${step}`}
            aria-selected={isCurrent}
            aria-disabled={isLocked}
            disabled={isLocked}
            tabIndex={tabIndexFor(isCurrent)}
            onClick={() => onStepClick(step)}
            className={buttonClass}
          >
            <span className={badgeClass}>{isDone ? '✓' : step}</span>
            {label}
          </button>
        )
      })}
    </div>
  )
}
