import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { buttonClasses } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import {
  SIGN_IN_PROVIDERS,
  LINK_ERROR_MESSAGES,
  UNLINK_ERROR_MESSAGES,
  providerLabel,
} from '@/lib/sign-in-providers'

export interface ConnectedAccountsStatus {
  linked?: string
  unlinked?: string
  linkError?: string
  unlinkError?: string
}

interface ConnectedAccountsSectionProps {
  /** Provider ids attached to this account, e.g. ['github', 'google']. */
  linked: string[]
  status?: ConnectedAccountsStatus
  connectAction: (formData: FormData) => Promise<void>
  disconnectAction: (formData: FormData) => Promise<void>
}

/**
 * Settings > Connected accounts: the only way a second sign-in method joins an
 * account. Connecting happens while signed in, so the person proves control of
 * both logins; nothing is ever linked just because two providers report the
 * same email address (security audit SEC-002).
 *
 * Plain forms posting to server actions, so it works without client-side JS
 * and every outcome comes back as a query parameter the page renders.
 */
export function ConnectedAccountsSection({
  linked,
  status = {},
  connectAction,
  disconnectAction,
}: ConnectedAccountsSectionProps) {
  const linkedSet = new Set(linked)
  const errorMessage =
    (status.linkError && (LINK_ERROR_MESSAGES[status.linkError] ?? 'Could not connect that account. Please try again.')) ||
    (status.unlinkError && (UNLINK_ERROR_MESSAGES[status.unlinkError] ?? 'Could not remove that account. Please try again.')) ||
    null
  const successMessage =
    (status.linked && linkedSet.has(status.linked) && `${providerLabel(status.linked)} is now connected. You can sign in with it.`) ||
    (status.unlinked && !linkedSet.has(status.unlinked) && `${providerLabel(status.unlinked)} was removed from your account.`) ||
    null

  return (
    <Card padding="lg" className="space-y-3">
      <div>
        <h2 className="text-base font-medium text-fg-heading">Connected accounts</h2>
        <p className="mt-1 text-sm text-fg-muted">
          The accounts you can sign in with. Connect another one here to sign in with either.
        </p>
      </div>

      {errorMessage && <ErrorBanner>{errorMessage}</ErrorBanner>}
      {successMessage && (
        <p role="status" className="rounded-control bg-surface-success px-3 py-2 text-sm text-fg-success">
          {successMessage}
        </p>
      )}

      <ul className="divide-y divide-border">
        {SIGN_IN_PROVIDERS.map(({ id, label }) => {
          const isLinked = linkedSet.has(id)
          const isOnlyOne = isLinked && linkedSet.size === 1
          return (
            <li key={id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-fg">{label}</span>
                {isLinked ? <Badge tone="success">Connected</Badge> : <Badge tone="neutral">Not connected</Badge>}
              </div>
              {isLinked ? (
                <form action={disconnectAction}>
                  <input type="hidden" name="provider" value={id} />
                  <button
                    type="submit"
                    disabled={isOnlyOne}
                    title={isOnlyOne ? 'Your only sign-in method cannot be removed' : undefined}
                    className={buttonClasses({ variant: 'dangerGhost', size: 'sm', className: 'disabled:opacity-50' })}
                  >
                    Remove
                  </button>
                </form>
              ) : (
                <form action={connectAction}>
                  <input type="hidden" name="provider" value={id} />
                  <button type="submit" className={buttonClasses({ variant: 'secondary', size: 'sm' })}>
                    Connect {label}
                  </button>
                </form>
              )}
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
