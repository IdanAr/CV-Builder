import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

const authMock = vi.fn()
const signInMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => authMock(), signIn: (...a: unknown[]) => signInMock(...a) }))

const unlinkMock = vi.fn()
vi.mock('@/lib/api/account', () => ({ unlinkProvider: (...a: unknown[]) => unlinkMock(...a) }))

import { connectProvider, disconnectProvider } from './actions'

const form = (provider: string) => {
  const fd = new FormData()
  fd.set('provider', provider)
  return fd
}

beforeEach(() => {
  vi.clearAllMocks()
  authMock.mockResolvedValue({ user: { id: 'u1' } })
})

describe('connectProvider', () => {
  it('starts the provider sign-in from the signed-in session, returning to Settings', async () => {
    await connectProvider(form('google'))
    expect(signInMock).toHaveBeenCalledWith('google', { redirectTo: '/dashboard/settings?linked=google' })
  })

  it('refuses without a session, so it can never act as a plain sign-in', async () => {
    authMock.mockResolvedValue(null)
    await expect(connectProvider(form('google'))).rejects.toThrow('NEXT_REDIRECT:/signin')
    expect(signInMock).not.toHaveBeenCalled()
  })

  it('ignores providers that are not offered', async () => {
    await expect(connectProvider(form('credentials'))).rejects.toThrow('NEXT_REDIRECT:/dashboard/settings')
    expect(signInMock).not.toHaveBeenCalled()
  })
})

describe('disconnectProvider', () => {
  it('unlinks for the session user, never a user named in the form', async () => {
    unlinkMock.mockResolvedValue({ ok: true })
    const fd = form('github')
    fd.set('userId', 'someone-else')
    await expect(disconnectProvider(fd)).rejects.toThrow('NEXT_REDIRECT:/dashboard/settings?unlinked=github')
    expect(unlinkMock).toHaveBeenCalledWith('u1', 'github')
  })

  it('reports why an unlink was refused', async () => {
    unlinkMock.mockResolvedValue({ ok: false, code: 'LAST_SIGN_IN_METHOD' })
    await expect(disconnectProvider(form('github'))).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard/settings?unlinkError=LAST_SIGN_IN_METHOD'
    )
  })

  it('refuses without a session', async () => {
    authMock.mockResolvedValue(null)
    await expect(disconnectProvider(form('github'))).rejects.toThrow('NEXT_REDIRECT:/signin')
    expect(unlinkMock).not.toHaveBeenCalled()
  })
})
