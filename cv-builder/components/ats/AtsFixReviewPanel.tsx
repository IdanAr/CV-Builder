'use client'

import type { AtsFix } from '@/lib/ai/ats-fix-pipeline'

interface AtsFixReviewPanelProps {
  fixes: AtsFix[]
  dismissedIds: Set<string>
  onApply: (fix: AtsFix) => void
  onDismiss: (id: string) => void
  onApplyAll: () => void
}

export function AtsFixReviewPanel({
  fixes,
  dismissedIds,
  onApply,
  onDismiss,
  onApplyAll,
}: AtsFixReviewPanelProps) {
  const visible = fixes.filter((f) => !dismissedIds.has(f.id))

  if (visible.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
        <p className="text-sm text-green-700 font-medium">All fixes applied or dismissed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-indigo-900">
          {visible.length} suggested {visible.length === 1 ? 'fix' : 'fixes'}
        </p>
        <button
          onClick={onApplyAll}
          className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Apply All
        </button>
      </div>

      {visible.map((fix) => (
        <div
          key={fix.id}
          className="rounded-xl border border-indigo-100 bg-white/80 backdrop-blur-sm p-4 shadow-sm space-y-2"
        >
          {fix.targetKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-1">
              {fix.targetKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-block rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          <div className="space-y-1 text-sm">
            <div className="rounded bg-red-50 border border-red-100 px-3 py-2">
              <p className="text-xs text-red-500 font-medium mb-0.5">Before</p>
              <p className="text-red-800 leading-relaxed line-through opacity-70">{fix.original}</p>
            </div>
            <div className="rounded bg-green-50 border border-green-100 px-3 py-2">
              <p className="text-xs text-green-600 font-medium mb-0.5">After</p>
              <p className="text-green-900 leading-relaxed">{fix.suggested}</p>
            </div>
          </div>

          {fix.pendingApprovals.length > 0 && (
            <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2">
              <p className="text-xs text-amber-700 font-medium mb-1">
                Contains figures not in your original text — verify before applying:
              </p>
              <div className="flex flex-wrap gap-1">
                {fix.pendingApprovals.map((claim) => (
                  <span
                    key={claim}
                    className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                  >
                    {claim}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onApply(fix)}
              className="px-3 py-1 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={() => onDismiss(fix.id)}
              className="px-3 py-1 text-xs text-indigo-400 hover:text-indigo-600 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
