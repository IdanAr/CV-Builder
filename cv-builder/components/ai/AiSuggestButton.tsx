// components/ai/AiSuggestButton.tsx
'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import type { SuggestionField, PipelineResult } from '@/lib/ai/pipeline'
import { Popover } from '@/components/ui/Popover'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { fetchWithTimeout, requestErrorMessage } from '@/lib/fetch-with-timeout'
import { highlightApprovals } from '@/lib/ai/highlight-approvals'
import { apiErrorMessage } from '@/lib/api/client-errors'

interface AiSuggestButtonProps {
  resumeId: string
  currentValue: string
  context: { jobTitle?: string; company?: string; field: SuggestionField }
  onAccept: (value: string) => void
}

export function AiSuggestButton({ resumeId, currentValue, context, onAccept }: AiSuggestButtonProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!resumeId || !currentValue.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetchWithTimeout(`/api/resumes/${resumeId}/ai-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: currentValue, ...context }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Failed to generate suggestion. Please try again.'))
      setResult(await res.json())
    } catch (err) {
      setError(requestErrorMessage(err, 'Failed to generate suggestion. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  function handleAccept() {
    if (result) {
      onAccept(result.suggestion)
      setResult(null)
    }
  }

  const open = !!error || !!result

  // A pending suggestion requires an explicit user decision - Popover's own
  // Escape handling still routes through `onOpenChange(false)` below, but
  // that intentionally no-ops for `result` (see comment there), so wire a
  // dedicated Escape dismissal here. Unlike a stray outside click, Escape is
  // an unambiguous, deliberate "close this" gesture with no other purpose in
  // this UI, and matches the Escape-always-closes-overlays convention users
  // already expect from Popover - so it stays a valid way to dismiss a
  // pending suggestion even though outside clicks no longer are.
  useEffect(() => {
    if (!result) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setResult(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [result])

  return (
    <div className="shrink-0">
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (next) return
          // Popover fires this for any outside click (or Escape). The error
          // panel is just a dismissible message, so it can keep closing on
          // an outside click. A pending `result`, though, is a rate-limited,
          // paid AI generation the user hasn't explicitly accepted or
          // dismissed yet - and when `result.pendingApprovals` is non-empty,
          // the hallucination guard requires the user to actually look at
          // and act on it. A stray outside click (e.g. clicking back into
          // the nearby textarea to compare the suggestion against the
          // original text) must not silently discard it. Deliberately do
          // NOT clear `result` here: only the explicit "Use this"/"Dismiss"
          // buttons (which call setResult(null) directly) or the Escape
          // handler above close it.
          setError(null)
        }}
        trigger={
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClick}
            disabled={loading || !currentValue.trim() || !resumeId}
            title={loading ? 'Generating AI suggestion…' : 'Generate an AI-written suggestion for this field'}
            aria-label={loading ? 'Generating AI suggestion…' : 'Generate an AI-written suggestion for this field'}
          >
            {loading ? (
              <Loader2 aria-hidden="true" data-testid="ai-suggest-loading-icon" className="h-4 w-4 motion-safe:animate-spin" strokeWidth={1.75} />
            ) : (
              <Sparkles aria-hidden="true" data-testid="ai-suggest-icon" className="h-4 w-4" strokeWidth={1.75} />
            )}
          </Button>
        }
      >
        {error && (
          <div
            role="status"
            aria-live="polite"
            className="w-56 rounded-card border border-border-danger bg-surface-danger p-2 shadow-popover"
          >
            <p className="text-xs text-fg-danger">{error}</p>
            <Button size="xs" variant="ghost" className="mt-1" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {result && (
          <div
            role="status"
            aria-live="polite"
            className="flex max-h-[60vh] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-card border border-border bg-surface p-3 shadow-popover"
          >
            {result.pendingApprovals.length > 0 && (
              <Badge
                tone="attention"
                className="mb-2 block overflow-visible whitespace-normal text-clip rounded-chip border border-border-attention px-2 py-1"
              >
                Highlighted items were not in your original notes - verify before accepting.
              </Badge>
            )}
            <p className="mb-3 text-sm leading-relaxed text-fg-body">
              {highlightApprovals(result.suggestion, result.pendingApprovals)}
            </p>
            <div className="flex gap-2">
              <Button size="xs" onClick={handleAccept}>
                Use this
              </Button>
              <Button size="xs" variant="ghost" onClick={() => setResult(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </Popover>
    </div>
  )
}
