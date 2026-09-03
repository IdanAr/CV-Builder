import { z } from 'zod'

/**
 * Account deletion is irreversible and unwinds every collection at once, so the
 * intent is checked on the server too, not only behind a dialog. The client
 * cannot be the only thing standing between a stray request and someone's data.
 *
 * Retyping the account's own email address is the convention here (GitHub and
 * Vercel both use it) because it cannot be satisfied by a reflexive click, and
 * because a request that does not carry the signed-in user's own address is
 * self-evidently not one they composed.
 */
export const DeleteAccountSchema = z.object({
  confirmEmail: z.string().min(1, 'Type your email address to confirm.'),
})

export type DeleteAccountInput = z.infer<typeof DeleteAccountSchema>
