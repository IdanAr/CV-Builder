'use client'

import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { inputClass } from '@/components/editor/forms/field-styles'
import { apiErrorMessage } from '@/lib/api/client-errors'
import { requestErrorMessage } from '@/lib/fetch-with-timeout'

/**
 * Account deletion — the other half of the privacy policy's promise.
 *
 * Two gates, deliberately different in kind. The first is a reveal, so the
 * irreversible control is never one stray click from a page someone opened to
 * change something else. The second is retyping your own email, which cannot be
 * satisfied reflexively and is re-checked by the server; see
 * app/api/account/route.ts.
 *
 * The sign-out afterwards is not cosmetic. This app uses JWT sessions, so
 * deleting the user document does not invalidate the token already in the
 * browser — without this the page would keep a live session pointing at a user
 * that no longer exists.
 */
export function DeleteAccountSection({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  // Focus the field when the form opens, and hand focus back to the trigger
  // when it closes — the same pattern the editor's popovers follow, so keyboard
  // users are never dropped at the top of the document.
  useEffect(() => {
    if (confirming) inputRef.current?.focus()
  }, [confirming])

  const matches = typed.trim().toLowerCase() === email.trim().toLowerCase()

  function cancel() {
    setConfirming(false)
    setTyped('')
    setError(null)
    triggerRef.current?.focus()
  }

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmEmail: typed }),
      })
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Could not delete your account. Please try again.'))

      // Deliberately no success toast: the redirect is the confirmation, and a
      // toast would be racing an unmount.
      await signOut({ callbackUrl: '/' })
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not delete your account. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <Card padding="lg" className="space-y-3 border-danger-200">
      <div>
        <h2 className="text-base font-semibold text-fg-danger">Delete your account</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Permanently removes your account and everything in it: every résumé and cover letter, every
          tracked application and its history, your board setup, and your job-search profiles, rules
          and saved matches. Files you have already exported or downloaded are unaffected.
        </p>
        <p className="mt-2 text-sm font-medium text-fg">This cannot be undone.</p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      {!confirming ? (
        <Button ref={triggerRef} variant="danger" size="md" onClick={() => setConfirming(true)}>
          <Trash2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          Delete my account
        </Button>
      ) : (
        <div className="space-y-3">
          <div>
            <label htmlFor="confirm-delete-email" className="block text-sm font-medium text-fg">
              Type <span className="font-semibold">{email}</span> to confirm
            </label>
            <input
              ref={inputRef}
              id="confirm-delete-email"
              type="email"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              // Autofilling the exact string that unlocks an irreversible
              // action would defeat the point of asking for it.
              autoComplete="off"
              className={`${inputClass} mt-1.5 max-w-sm`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="danger" size="md" onClick={handleDelete} disabled={!matches || busy}>
              {busy ? 'Deleting…' : 'Permanently delete'}
            </Button>
            <Button variant="ghost" size="md" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
