// lib/sign-in-providers.ts
// The sign-in providers a user can connect, and the messages shown when
// connecting or signing in with one fails. Shared by the sign-in page and
// Settings > Connected accounts so the two never disagree.

export const SIGN_IN_PROVIDERS = [
  { id: 'google', label: 'Google' },
  { id: 'github', label: 'GitHub' },
] as const

export type SignInProviderId = (typeof SIGN_IN_PROVIDERS)[number]['id']

export function isSignInProvider(value: unknown): value is SignInProviderId {
  return SIGN_IN_PROVIDERS.some((p) => p.id === value)
}

export function providerLabel(id: string): string {
  return SIGN_IN_PROVIDERS.find((p) => p.id === id)?.label ?? id
}

/**
 * Errors Auth.js (or our signIn callback) can send back while someone who is
 * already signed in connects another provider. The sign-in page forwards these
 * to Settings instead of bouncing a signed-in user to the dashboard with the
 * error silently dropped.
 */
export const LINK_ERROR_MESSAGES: Record<string, string> = {
  OAuthAccountNotLinked:
    'That account is already connected to a different CVitae account, so it was not added here.',
  GoogleEmailUnverified:
    'That Google account has no verified email address. Verify it with Google, then try again.',
  AccessDenied: 'Connecting was cancelled. Nothing changed.',
}

export const UNLINK_ERROR_MESSAGES: Record<string, string> = {
  LAST_SIGN_IN_METHOD:
    'This is your only way to sign in. Connect another account first, then you can remove this one.',
  NOT_LINKED: 'That account was not connected.',
}
