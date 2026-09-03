import { describe, it, expect, vi, afterEach } from 'vitest'

let mockSession: { user: { id: string; email?: string | null } } | null = {
  user: { id: 'user-1', email: 'Ada@Example.com' },
}

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: mockSession }), ctx)
  }),
}))

const deleteUserAccount = vi.fn(async () => ({ resumes: 2, user: 1 }))
vi.mock('@/lib/api/account', () => ({ deleteUserAccount: (...a: unknown[]) => deleteUserAccount(...(a as [])) }))

afterEach(() => {
  vi.clearAllMocks()
  mockSession = { user: { id: 'user-1', email: 'Ada@Example.com' } }
})

function request(body: unknown) {
  return new Request('http://localhost/api/account', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('DELETE /api/account', () => {
  it('returns 401 when not authenticated', async () => {
    mockSession = null
    const { DELETE } = await import('./route')
    const res = (await DELETE(request({ confirmEmail: 'ada@example.com' }) as never, {} as never)) as Response
    expect(res.status).toBe(401)
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })

  it('rejects a request with no confirmation at all', async () => {
    const { DELETE } = await import('./route')
    const res = (await DELETE(request({}) as never, {} as never)) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('VALIDATION_ERROR')
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })

  // The one that matters. The dialog is a usability affordance; this is the
  // check that stands between a malformed or forged request and seven
  // collections. If the confirmation is wrong, nothing may be deleted.
  it('deletes nothing when the confirmation does not match', async () => {
    const { DELETE } = await import('./route')
    const res = (await DELETE(request({ confirmEmail: 'someone@else.com' }) as never, {} as never)) as Response
    expect(res.status).toBe(400)
    expect((await res.json()).code).toBe('CONFIRMATION_MISMATCH')
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })

  it('deletes the account when the confirmation matches', async () => {
    const { DELETE } = await import('./route')
    const res = (await DELETE(request({ confirmEmail: 'Ada@Example.com' }) as never, {} as never)) as Response
    expect(res.status).toBe(200)
    expect(deleteUserAccount).toHaveBeenCalledWith('user-1')
    expect((await res.json()).deleted).toEqual({ resumes: 2, user: 1 })
  })

  // Providers differ in how they capitalise an address, and holding someone to
  // their provider's casing while they delete their account is hostile for no
  // security gain.
  it('accepts the address in any casing, with surrounding whitespace', async () => {
    const { DELETE } = await import('./route')
    const res = (await DELETE(request({ confirmEmail: '  ADA@example.com  ' }) as never, {} as never)) as Response
    expect(res.status).toBe(200)
    expect(deleteUserAccount).toHaveBeenCalledWith('user-1')
  })

  // Without an email there is nothing to confirm against, so the comparison
  // must fail closed rather than treating two empty values as a match.
  it('refuses when the account has no email to confirm against', async () => {
    mockSession = { user: { id: 'user-1', email: null } }
    const { DELETE } = await import('./route')
    const res = (await DELETE(request({ confirmEmail: '' }) as never, {} as never)) as Response
    expect(res.status).toBe(400)
    expect(deleteUserAccount).not.toHaveBeenCalled()
  })
})
