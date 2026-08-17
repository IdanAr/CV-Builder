// components/ai/AiSuggestButton.tsx
'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import type { SuggestionField, PipelineResult } from '@/lib/ai/pipeline'
import { Popover } from '@/components/ui/Popover'

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
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PipelineResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    if (!resumeId || !currentValue.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
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
      setResult(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestion. Please try again.')
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

  return (
    <div className="shrink-0">
      <Popover
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setError(null)
            setResult(null)
          }
        }}
        trigger={
          <button
            type="button"
            onClick={handleClick}
            disabled={loading || !currentValue.trim() || !resumeId}
            title={loading ? 'Generating AI suggestion…' : 'Generate an AI-written suggestion for this field'}
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
                onClick={() => setResult(null)}
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
