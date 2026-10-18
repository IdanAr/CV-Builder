'use server'

import { redirect } from 'next/navigation'
import { auth, signIn } from '@/lib/auth'
import { unlinkProvider } from '@/lib/api/account'
import { isSignInProvider } from '@/lib/sign-in-providers'

const SETTINGS = '/dashboard/settings'

/**
 * Starts an OAuth sign-in for another provider while the user is signed in.
 * Auth.js sees the existing session on the callback and attaches the new
 * provider account to *this* user, which is the only way accounts get linked
 * now that email-based auto-linking is off (security audit SEC-002).
 *
 * The session check is not decoration: without one, this would be an ordinary
 * sign-in, which is the signed-out page's job.
 */
export async function connectProvider(formData: FormData): Promise<void> {
  const provider = formData.get('provider')
  if (!isSignInProvider(provider)) redirect(SETTINGS)

  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  await signIn(provider, { redirectTo: `${SETTINGS}?linked=${provider}` })
}

export async function disconnectProvider(formData: FormData): Promise<void> {
  const provider = formData.get('provider')
  if (!isSignInProvider(provider)) redirect(SETTINGS)

  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const result = await unlinkProvider(session.user.id, provider)
  redirect(result.ok ? `${SETTINGS}?unlinked=${provider}` : `${SETTINGS}?unlinkError=${result.code}`)
}
