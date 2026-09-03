'use client'

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
    <div className="flex bg-indigo-50 rounded-full p-1 gap-1" role="tablist" aria-label="ATS analysis steps">
      {STEPS.map((step) => {
        const isCurrent = step === current
        const isLocked = step > maxUnlocked
        const isDone = !isCurrent && !isLocked

        const buttonClass = isCurrent
          ? 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium bg-indigo-600 text-white shadow-md transition-colors'
          : isDone
          ? 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors'
          : 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-fg-subtle cursor-not-allowed'

        const badgeClass = isCurrent
          ? 'flex items-center justify-center h-4 w-4 rounded-full bg-white/25 text-[10px]'
          : isDone
          ? 'flex items-center justify-center h-4 w-4 rounded-full bg-indigo-200 text-[10px]'
          : 'flex items-center justify-center h-4 w-4 rounded-full bg-indigo-100 text-[10px]'

        return (
          <button
            key={step}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            aria-disabled={isLocked}
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
