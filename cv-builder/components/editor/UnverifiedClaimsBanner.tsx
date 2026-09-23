'use client'

import { useState } from 'react'
import { AlertTriangle, Check } from 'lucide-react'

/**
 * Warns that this résumé contains AI-written phrases the hallucination guard
 * could not trace back to the user's own text.
 *
 * Interactive AI in this app holds such text back until the user accepts it.
 * The job-search pipeline cannot: it runs unattended, so it writes the draft
 * and records what was unverified. Until now that record lived only on the
 * sibling ScrapedJob row, which meant opening the draft directly — or
 * exporting it — showed nothing at all, and the user could send out claims
 * nothing had checked.
 *
 * Clearing the list is a blanket attestation that the user has read them,
 * matching the trust model approveScrapedJob already uses for the queue.
 */
export function UnverifiedClaimsBanner({
  resumeId,
  claims,
}: {
  resumeId: string
  claims: string[]
}) {
  const [dismissed, setDismissed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  if (claims.length === 0 || dismissed) return null

  async function confirm() {
    setSaving(true)
    setFailed(false)
    try {
      const res = await fetch(`/api/resumes/${resumeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pendingApprovals: [] }),
      })
      if (!res.ok) throw new Error('Could not save')
      setDismissed(true)
    } catch {
      // Staying visible on failure is the point: silently hiding the warning
      // would leave unverified claims unflagged in the document.
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="status"
      className="mx-4 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {claims.length === 1
              ? 'One claim in this draft was written by AI and not verified'
              : `${claims.length} claims in this draft were written by AI and not verified`}
          </p>
          <p className="mt-1 text-sm">
            This résumé was tailored automatically. These phrases could not be matched to anything
            in your own text — check them before you send it anywhere.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {claims.map((claim) => (
              <li
                key={claim}
                className="rounded bg-amber-200/70 px-1.5 py-0.5 font-mono text-xs text-amber-950"
              >
                {claim}
              </li>
            ))}
          </ul>
          {failed && (
            <p className="mt-2 text-sm font-medium text-red-700">
              Could not save that. Try again.
            </p>
          )}
          <button
            type="button"
            onClick={confirm}
            disabled={saving}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-400 bg-white px-2.5 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            <Check aria-hidden="true" className="h-3.5 w-3.5" />
            {saving ? 'Saving…' : "I've checked these"}
          </button>
        </div>
      </div>
    </div>
  )
}
