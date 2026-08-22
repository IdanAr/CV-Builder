'use client'

interface ProfileWizardStepsProps {
  current: number
  maxUnlocked: number
  labels: string[]
  onStepClick: (step: number) => void
}

export function ProfileWizardSteps({ current, maxUnlocked, labels, onStepClick }: ProfileWizardStepsProps) {
  return (
    <div className="flex bg-indigo-50 rounded-full p-1 gap-1" role="tablist" aria-label="Job search profile setup steps">
      {labels.map((label, index) => {
        const step = index + 1
        const isCurrent = step === current
        const isLocked = step > maxUnlocked
        const isDone = !isCurrent && !isLocked

        const buttonClass = isCurrent
          ? 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium bg-indigo-600 text-white shadow-md transition-colors'
          : isDone
          ? 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors'
          : 'flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-indigo-300 cursor-not-allowed'

        const badgeClass = isCurrent
          ? 'flex items-center justify-center h-4 w-4 rounded-full bg-white/25 text-[10px]'
          : isDone
          ? 'flex items-center justify-center h-4 w-4 rounded-full bg-indigo-200 text-[10px]'
          : 'flex items-center justify-center h-4 w-4 rounded-full bg-indigo-100 text-[10px]'

        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={isCurrent}
            aria-disabled={isLocked}
            disabled={isLocked}
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
