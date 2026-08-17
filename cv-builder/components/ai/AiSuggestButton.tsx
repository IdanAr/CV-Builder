// components/ai/AiSuggestButton.tsx
'use client'

import { useEffect, useId, useState, useSyncExternalStore } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import type { SuggestionField, PipelineResult } from '@/lib/ai/pipeline'
import { Popover } from '@/components/ui/Popover'

// A pending suggestion now survives an outside click (see the Popover
// onOpenChange comment below), so without this, generating a second
// suggestion in a different field while an earlier one is still pending
// would leave two overlapping, `fixed`-positioned panels open at once, and
// a single Escape would discard both. At most one instance may hold an
// unresolved pending suggestion at a time; a tiny module-level pub-sub
// (not a shared primitive — nothing else in the app needs this) tracks
// which instance currently owns that slot so every other instance's
// trigger can disable itself while it's held.
let pendingOwnerId: string | null = null
const pendingOwnerListeners = new Set<() => void>()

function subscribePendingOwner(listener: () => void): () => void {
  pendingOwnerListeners.add(listener)
  return () => pendingOwnerListeners.delete(listener)
}

function getPendingOwnerId(): string | null {
  return pendingOwnerId
}

function claimPendingOwner(id: string) {
  pendingOwnerId = id
  pendingOwnerListeners.forEach((listener) => listener())
}

function releasePendingOwner(id: string) {
  if (pendingOwnerId !== id) return
  pendingOwnerId = null
  pendingOwnerListeners.forEach((listener) => listener())
}

interface AiSuggestButtonProps {
  resumeId: string
  currentValue: string
  context: { jobTitle?: string; company?: string; field: SuggestionField }
  onAccept: (value: string) => void
}

function highlightApprovals(text: string, approvals: string[]): React.ReactNode {
  if (approvals.length === 0) return <>{text}</>
  let nodes: Array<string | React.ReactElement> = [text]
  for (const phrase of approvals) {
    const nextNodes: Array<string | React.ReactElement> = []
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (typeof node !== 'string') {
        nextNodes.push(node)
        continue
      }
      const lowerNode = node.toLowerCase()
      const idx = lowerNode.indexOf(phrase.toLowerCase())
      if (idx === -1) {
        nextNodes.push(node)
        continue
      }
      if (idx > 0) nextNodes.push(node.slice(0, idx))
      nextNodes.push(
        <mark
          key={`${i}-${phrase}`}
          className="bg-yellow-200 text-yellow-900 rounded px-0.5"
          title="Not in your original notes — please verify before accepting"
        >
          {node.slice(idx, idx + phrase.length)}
        </mark>
      )
      if (idx + phrase.length < node.length) {
        nextNodes.push(node.slice(idx + phrase.length))
      }
    }
    nodes = nextNodes
  }
  return <>{nodes}</>
}

export function AiSuggestButton({ resumeId, currentValue, context, onAccept }: AiSuggestButtonProps) {
  const instanceId = useId()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pendingOwner = useSyncExternalStore(subscribePendingOwner, getPendingOwnerId, () => null)
  const disabledByAnotherPending = pendingOwner !== null && pendingOwner !== instanceId

  function clearResult() {
    setResult(null)
    releasePendingOwner(instanceId)
  }

  // Release the slot if this instance unmounts (e.g. its field/section is
  // deleted) while still holding a pending suggestion — otherwise every
  // other instance would stay disabled forever with no way to recover it.
  useEffect(() => () => releasePendingOwner(instanceId), [instanceId])

  async function handleClick() {
    if (!resumeId || !currentValue.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    releasePendingOwner(instanceId)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/ai-suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: currentValue, ...context }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error((json as { error?: string }).error ?? 'Failed to generate suggestion. Please try again.')
      }
      const json = (await res.json()) as PipelineResult
      setResult(json)
      claimPendingOwner(instanceId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestion. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleAccept() {
    if (result) {
      onAccept(result.suggestion)
      clearResult()
    }
  }

  const open = !!error || !!result

  // A pending suggestion requires an explicit user decision — Popover's own
  // Escape handling still routes through `onOpenChange(false)` below, but
  // that intentionally no-ops for `result` (see comment there), so wire a
  // dedicated Escape dismissal here. Unlike a stray outside click, Escape is
  // an unambiguous, deliberate "close this" gesture with no other purpose in
  // this UI, and matches the Escape-always-closes-overlays convention users
  // already expect from Popover — so it stays a valid way to dismiss a
  // pending suggestion even though outside clicks no longer are.
  useEffect(() => {
    if (!result) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') clearResult()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [result]) // eslint-disable-line react-hooks/exhaustive-deps -- clearResult is stable per instanceId, which never changes

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
          // dismissed yet — and when `result.pendingApprovals` is non-empty,
          // the hallucination guard requires the user to actually look at
          // and act on it. A stray outside click (e.g. clicking back into
          // the nearby textarea to compare the suggestion against the
          // original text) must not silently discard it. Deliberately do
          // NOT clear `result` here: only the explicit "Use this"/"Dismiss"
          // buttons (which call clearResult, also releasing the pending-owner
          // slot below) or the Escape handler above close it.
          setError(null)
        }}
        trigger={
          <button
            type="button"
            onClick={handleClick}
            disabled={loading || !currentValue.trim() || !resumeId || disabledByAnotherPending}
            title={
              disabledByAnotherPending
                ? 'Resolve the other pending AI suggestion first'
                : loading ? 'Generating AI suggestion…' : 'Generate an AI-written suggestion for this field'
            }
            aria-label={loading ? 'Generating AI suggestion…' : 'Generate an AI-written suggestion for this field'}
            className="px-1.5 py-1 text-sm text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors disabled:opacity-30"
          >
            {loading ? (
              <Loader2 aria-hidden="true" data-testid="ai-suggest-loading-icon" className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Sparkles aria-hidden="true" data-testid="ai-suggest-icon" className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        }
      >
        {error && (
          <div
            role="status"
            aria-live="polite"
            className="w-56 rounded-lg border border-red-200 bg-red-50 p-2 shadow-sm"
          >
            <p className="text-xs text-red-600">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-1 text-xs text-red-400 hover:text-red-600"
            >
              Dismiss
            </button>
          </div>
        )}

        {result && (
          <div
            role="status"
            aria-live="polite"
            className="flex max-h-[60vh] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-xl border border-indigo-200 bg-white/90 backdrop-blur-xl p-3 shadow-xl"
          >
            {result.pendingApprovals.length > 0 && (
              <p className="mb-2 rounded border border-yellow-200 bg-yellow-50 px-2 py-1 text-xs text-yellow-700">
                Highlighted items were not in your original notes — verify before accepting.
              </p>
            )}
            <p className="mb-3 text-sm leading-relaxed text-gray-800">
              {highlightApprovals(result.suggestion, result.pendingApprovals)}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleAccept}
                className="rounded-lg bg-indigo-600 px-3 py-1 text-xs text-white transition-colors hover:bg-indigo-700"
              >
                Use this
              </button>
              <button
                onClick={clearResult}
                className="rounded px-3 py-1 text-xs text-indigo-500 transition-colors hover:text-indigo-700"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </Popover>
    </div>
  )
}
