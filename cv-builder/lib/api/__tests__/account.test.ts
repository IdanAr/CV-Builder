import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Every model is mocked with a recorder so the tests can assert *what* was
 * asked of the database — the filter, and the order of the calls — rather than
 * standing up a Mongo instance. For deletion that ordering is the safety
 * property, so it has to be observable.
 */
const calls: string[] = []

function mockModel(name: string, docs: unknown[] = [], deletedCount = 0) {
  return {
    find: vi.fn((filter: unknown) => {
      calls.push(`find:${name}:${JSON.stringify(filter)}`)
      return { lean: async () => docs }
    }),
    deleteMany: vi.fn(async (filter: unknown) => {
      calls.push(`deleteMany:${name}:${JSON.stringify(filter)}`)
      return { deletedCount }
    }),
  }
}

vi.mock('@/lib/db', () => ({ default: vi.fn(async () => undefined) }))
vi.mock('@/models/Resume', () => ({ default: mockModel('Resume', [{ title: 'CV' }], 2) }))
vi.mock('@/models/Application', () => ({ default: mockModel('Application', [], 3) }))
vi.mock('@/models/ApplicationActivity', () => ({ default: mockModel('ApplicationActivity', [], 4) }))
vi.mock('@/models/BoardConfig', () => ({ default: mockModel('BoardConfig', [], 1) }))
vi.mock('@/models/JobSearchProfile', () => ({ default: mockModel('JobSearchProfile', [], 5) }))
vi.mock('@/models/JobSearchRule', () => ({ default: mockModel('JobSearchRule', [], 6) }))
vi.mock('@/models/ScrapedJob', () => ({ default: mockModel('ScrapedJob', [], 7) }))

const accountsCollection = {
  find: vi.fn(() => ({
    project: () => ({ toArray: async () => [{ provider: 'github' }, { provider: 'google' }] }),
  })),
  deleteMany: vi.fn(async () => {
    calls.push('deleteMany:accounts')
    return { deletedCount: 2 }
  }),
}
const sessionsCollection = {
  deleteMany: vi.fn(async () => {
    calls.push('deleteMany:sessions')
    return { deletedCount: 0 }
  }),
}
const usersCollection = {
  deleteOne: vi.fn(async () => {
    calls.push('deleteOne:users')
    return { deletedCount: 1 }
  }),
}

vi.mock('@/lib/mongodb', () => ({
  default: Promise.resolve({
    db: () => ({
      collection: (name: string) =>
        ({ accounts: accountsCollection, sessions: sessionsCollection, users: usersCollection })[name],
    }),
  }),
}))

const VALID_ID = '507f1f77bcf86cd799439011'

beforeEach(() => {
  calls.length = 0
})

describe('exportUserData', () => {
  it('includes every user-owned collection', async () => {
    const { exportUserData, USER_OWNED_KEYS } = await import('../account')
    const data = await exportUserData(VALID_ID, { name: 'Ada', email: 'ada@example.com' })
    for (const key of USER_OWNED_KEYS) {
      expect(data, `export is missing "${key}"`).toHaveProperty(key)
    }
  })

  it('scopes every query to the requesting user', async () => {
    const { exportUserData } = await import('../account')
    await exportUserData(VALID_ID, {})
    const finds = calls.filter((c) => c.startsWith('find:'))
    expect(finds).toHaveLength(7)
    for (const call of finds) {
      expect(call, `unscoped query: ${call}`).toContain(`{"userId":"${VALID_ID}"}`)
    }
  })

  // The export lands in a downloads folder. Auth.js stores the user's live
  // Google/GitHub access and refresh tokens on the `accounts` documents, and
  // writing those into a file would create a far larger risk than the export
  // solves. Which providers are linked is useful; the credentials are not.
  it('names the linked providers without exporting their tokens', async () => {
    const { exportUserData } = await import('../account')
    const data = await exportUserData(VALID_ID, {})
    expect(data.linkedSignInProviders).toEqual(['github', 'google'])
    const serialised = JSON.stringify(data)
    expect(serialised).not.toContain('access_token')
    expect(serialised).not.toContain('refresh_token')
  })

  it('records who the export belongs to and when it was made', async () => {
    const { exportUserData } = await import('../account')
    const data = await exportUserData(VALID_ID, { name: 'Ada', email: 'ada@example.com' })
    expect(data.account).toEqual({ id: VALID_ID, name: 'Ada', email: 'ada@example.com' })
    expect(Date.parse(data.exportedAt)).not.toBeNaN()
  })
})

describe('deleteUserAccount', () => {
  it('deletes from every user-owned collection, scoped to that user', async () => {
    const { deleteUserAccount, USER_OWNED_KEYS } = await import('../account')
    const summary = await deleteUserAccount(VALID_ID)
    const deletes = calls.filter((c) => c.startsWith('deleteMany:') && c.includes('{'))
    expect(deletes).toHaveLength(USER_OWNED_KEYS.length)
    for (const call of deletes) {
      expect(call, `unscoped delete: ${call}`).toContain(`{"userId":"${VALID_ID}"}`)
    }
    expect(summary.resumes).toBe(2)
    expect(summary.scrapedJobs).toBe(7)
  })

  // The ordering IS the safety property. These deletes are not a transaction —
  // that needs a replica set, and nothing in this repo uses one — so a
  // part-way failure is possible. Removing the sign-in record last means a
  // failure leaves the user able to sign in and retry; the reverse order would
  // strand data behind a login that no longer exists, reachable and deletable
  // by nobody.
  it('removes the sign-in record only after the data it owns', async () => {
    const { deleteUserAccount } = await import('../account')
    await deleteUserAccount(VALID_ID)
    const userDelete = calls.indexOf('deleteOne:users')
    expect(userDelete).toBeGreaterThan(-1)
    const lastDataDelete = calls.reduce(
      (last, c, i) => (c.startsWith('deleteMany:') && c.includes('userId') ? i : last),
      -1
    )
    expect(lastDataDelete).toBeGreaterThan(-1)
    expect(userDelete).toBeGreaterThan(lastDataDelete)
  })

  it('clears linked accounts and any sessions', async () => {
    const { deleteUserAccount } = await import('../account')
    const summary = await deleteUserAccount(VALID_ID)
    expect(summary.linkedAccounts).toBe(2)
    expect(summary).toHaveProperty('sessions')
    expect(summary.user).toBe(1)
  })

  // session.user.id arrives from a JWT and is not re-validated, so a malformed
  // value must not throw out of a delete — the user's own data still goes.
  it('still deletes the data when the id is not a valid ObjectId', async () => {
    const { deleteUserAccount } = await import('../account')
    const summary = await deleteUserAccount('not-an-object-id')
    expect(summary.resumes).toBe(2)
    expect(calls).not.toContain('deleteOne:users')
  })
})

describe('the user-owned collection list', () => {
  // The guard against a new model quietly escaping both export and deletion.
  // Anything added under models/ that carries a userId has to be added to
  // USER_OWNED, or someone's data survives an account deletion.
  it('covers every model that stores data per user', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const modelsDir = join(process.cwd(), 'models')

    const userOwnedModels = readdirSync(modelsDir)
      .filter((f) => f.endsWith('.ts') && !f.includes('.test.'))
      .filter((f) => /userId:\s*\{/.test(readFileSync(join(modelsDir, f), 'utf8')))
      .map((f) => f.replace(/\.ts$/, ''))

    const { USER_OWNED_KEYS } = await import('../account')
    expect(
      userOwnedModels.length,
      `models/ has ${userOwnedModels.length} user-owned models but account.ts lists ${USER_OWNED_KEYS.length}`
    ).toBe(USER_OWNED_KEYS.length)
  })
})
