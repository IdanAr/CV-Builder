import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { deleteUserAccount } from '@/lib/api/account'
import { DeleteAccountSchema } from '@/lib/schemas/account.zod'
import { apiError, handleRouteError } from '@/lib/api/route-errors'

/**
 * Deletes the signed-in user's account and everything in it.
 *
 * The confirmation is re-checked here rather than trusted from the dialog: the
 * UI gate is a usability affordance, and an endpoint that erases seven
 * collections should not be one unauthenticated-looking POST away from firing.
 *
 * Note for callers: this app uses JWT sessions, so removing the user document
 * does not invalidate a token already in the browser. The client must sign out
 * immediately after a 200 — components/account/DeleteAccountSection.tsx does —
 * or the holder keeps a session pointing at a user that no longer exists.
 */
export const DELETE = auth(async function DELETE(req) {
  const user = req.auth?.user
  if (!user?.id) {
    return apiError('UNAUTHORIZED', 'Unauthorized', 401)
  }
  try {
    const body = await req.json().catch(() => ({}))
    const parsed = DeleteAccountSchema.safeParse(body)
    if (!parsed.success) {
      return apiError('VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues)
    }

    // Compared case-insensitively: providers vary in how they capitalise the
    // address, and holding someone to their provider's casing while deleting
    // their account is hostile for no security gain.
    const expected = user.email?.trim().toLowerCase()
    if (!expected || parsed.data.confirmEmail.trim().toLowerCase() !== expected) {
      return apiError('CONFIRMATION_MISMATCH', 'That does not match the email on this account.', 400)
    }

    const deleted = await deleteUserAccount(user.id)
    return NextResponse.json({ deleted })
  } catch (err) {
    return handleRouteError(err, 'DELETE /api/account')
  }
})
