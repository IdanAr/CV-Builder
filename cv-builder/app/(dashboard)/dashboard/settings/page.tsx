import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'
import { Card } from '@/components/ui/Card'
import { ExportDataSection } from '@/components/account/ExportDataSection'
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection'

export const metadata: Metadata = {
  title: 'Settings',
}

/**
 * The account surface the product did not have.
 *
 * app/privacy/page.tsx commits to data access, correction and deletion rights,
 * and the only route it offered for any of them was an email address. This page
 * is where those rights are actually exercisable.
 */
export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const { name, email } = session.user

  return (
    <>
      <AppNavbar
        actions={
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="ml-auto rounded-md border border-indigo-200 bg-white/50 px-3 py-1.5 text-sm font-medium text-indigo-700 transition hover:bg-indigo-50"
            >
              Back to dashboard
            </Link>
            <UserProfileButton user={session.user} />
          </div>
        }
      />

      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-fg-heading">Settings</h1>
        <p className="mt-1 text-sm text-fg-muted">Your account, and what happens to the data in it.</p>

        <div className="mt-6 space-y-4">
          <Card padding="lg">
            <h2 className="text-base font-semibold text-fg-heading">Account</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex flex-wrap gap-x-3">
                <dt className="w-24 shrink-0 text-fg-muted">Name</dt>
                <dd className="min-w-0 break-words text-fg">{name ?? '—'}</dd>
              </div>
              <div className="flex flex-wrap gap-x-3">
                <dt className="w-24 shrink-0 text-fg-muted">Email</dt>
                <dd className="min-w-0 break-words text-fg">{email ?? '—'}</dd>
              </div>
            </dl>
            {/* Not an oversight that these are read-only. Both come from the
                Google or GitHub account you sign in with, and this app holds no
                password of its own, so editing them here would either desync on
                the next sign-in or quietly do nothing. */}
            <p className="mt-3 text-sm text-fg-muted">
              These come from the account you sign in with. Change them with your sign-in provider and
              they will update here the next time you sign in.
            </p>
          </Card>

          <ExportDataSection />

          {/* Deletion needs the email to confirm against. Without one there is
              nothing to type, so the section says so rather than rendering a
              control that cannot succeed. */}
          {email ? (
            <DeleteAccountSection email={email} />
          ) : (
            <Card padding="lg">
              <h2 className="text-base font-semibold text-fg-heading">Delete your account</h2>
              <p className="mt-1 text-sm text-fg-muted">
                Deleting an account is confirmed by retyping its email address, and this account has
                none on file. Contact support and we will remove it for you.
              </p>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
