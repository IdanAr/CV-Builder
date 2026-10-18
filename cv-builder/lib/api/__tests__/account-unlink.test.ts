import { describe, it, expect, vi, beforeEach } from 'vitest'

// A tiny in-memory `accounts` collection with just the operations
// listLinkedProviders and unlinkProvider use, so the tests assert outcomes
// (which rows remain) rather than the shape of each call.
type Row = { userId: { toString(): string }; provider: string }
let rows: Row[] = []

const matches = (row: Row, filter: Record<string, unknown>) =>
  Object.entries(filter).every(([key, cond]) => {
    const value = key === 'userId' ? row.userId.toString() : row[key as keyof Row]
    if (cond && typeof cond === 'object' && '$ne' in cond) return value !== (cond as { $ne: unknown }).$ne
    return value === (key === 'userId' ? String(cond) : cond)
  })

const accounts = {
  find: (filter: Record<string, unknown>) => ({
    project: () => ({ toArray: async () => rows.filter((r) => matches(r, filter)) }),
  }),
  countDocuments: async (filter: Record<string, unknown>) => rows.filter((r) => matches(r, filter)).length,
  deleteMany: vi.fn(async (filter: Record<string, unknown>) => {
    const before = rows.length
    rows = rows.filter((r) => !matches(r, filter))
    return { deletedCount: before - rows.length }
  }),
}

vi.mock('@/lib/mongodb', () => ({
  default: Promise.resolve({ db: () => ({ collection: () => accounts }) }),
}))
vi.mock('@/lib/db', () => ({ default: vi.fn(async () => undefined) }))
for (const m of ['Resume', 'Application', 'ApplicationActivity', 'BoardConfig', 'JobSearchProfile', 'JobSearchRule', 'ScrapedJob', 'AiCache']) {
  vi.doMock(`@/models/${m}`, () => ({ default: {} }))
}

const ME = '507f1f77bcf86cd799439011'
const SOMEONE_ELSE = '507f1f77bcf86cd799439022'
const row = (userId: string, provider: string): Row => ({ userId: { toString: () => userId }, provider })

beforeEach(() => {
  rows = []
  accounts.deleteMany.mockClear()
})

describe('listLinkedProviders', () => {
  it('lists only this user’s providers, sorted and de-duplicated', async () => {
    rows = [row(ME, 'google'), row(ME, 'github'), row(ME, 'github'), row(SOMEONE_ELSE, 'google')]
    const { listLinkedProviders } = await import('../account')
    expect(await listLinkedProviders(ME)).toEqual(['github', 'google'])
  })

  it('returns nothing for a malformed id', async () => {
    const { listLinkedProviders } = await import('../account')
    expect(await listLinkedProviders('not-an-object-id')).toEqual([])
  })
})

describe('unlinkProvider', () => {
  it('removes one provider when another remains', async () => {
    rows = [row(ME, 'google'), row(ME, 'github')]
    const { unlinkProvider } = await import('../account')
    expect(await unlinkProvider(ME, 'github')).toEqual({ ok: true })
    expect(rows.map((r) => r.provider)).toEqual(['google'])
  })

  it('refuses to remove the last sign-in method', async () => {
    rows = [row(ME, 'github')]
    const { unlinkProvider } = await import('../account')
    expect(await unlinkProvider(ME, 'github')).toEqual({ ok: false, code: 'LAST_SIGN_IN_METHOD' })
    expect(rows).toHaveLength(1)
    expect(accounts.deleteMany).not.toHaveBeenCalled()
  })

  it('does not count another user’s accounts as a remaining sign-in method', async () => {
    rows = [row(ME, 'github'), row(SOMEONE_ELSE, 'google')]
    const { unlinkProvider } = await import('../account')
    expect(await unlinkProvider(ME, 'github')).toEqual({ ok: false, code: 'LAST_SIGN_IN_METHOD' })
  })

  it('never touches another user’s rows', async () => {
    rows = [row(ME, 'github'), row(ME, 'google'), row(SOMEONE_ELSE, 'github')]
    const { unlinkProvider } = await import('../account')
    await unlinkProvider(ME, 'github')
    expect(rows.filter((r) => r.userId.toString() === SOMEONE_ELSE)).toHaveLength(1)
  })

  it('reports a provider that was never linked', async () => {
    rows = [row(ME, 'github'), row(ME, 'google')]
    const { unlinkProvider } = await import('../account')
    expect(await unlinkProvider(ME, 'gitlab')).toEqual({ ok: false, code: 'NOT_LINKED' })
  })
})
