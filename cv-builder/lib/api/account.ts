// lib/api/account.ts
// Data access for the two account-level rights the privacy policy commits to:
// getting a copy of your data, and deleting it.
//
// app/privacy/page.tsx has always promised both, and until this file there was
// no settings page and no endpoint behind either — the policy directed users to
// email support and hope. These are the product half of that promise.
import { ObjectId } from 'mongodb'
import dbConnect from '@/lib/db'
import clientPromise from '@/lib/mongodb'
import Resume from '@/models/Resume'
import Application from '@/models/Application'
import ApplicationActivity from '@/models/ApplicationActivity'
import BoardConfig from '@/models/BoardConfig'
import JobSearchProfile from '@/models/JobSearchProfile'
import JobSearchRule from '@/models/JobSearchRule'
import ScrapedJob from '@/models/ScrapedJob'

/**
 * Every collection that holds something belonging to a user.
 *
 * All seven are keyed by `userId` directly — including ApplicationActivity and
 * ScrapedJob, which could plausibly have been keyed only by their parent — so
 * both export and deletion are a flat sweep rather than a cascade. Anything
 * added later that stores user data has to be added here; the count assertion
 * in `__tests__/account.test.ts` fails if a model is added and forgotten.
 */
const USER_OWNED = [
  ['resumes', Resume],
  ['applications', Application],
  ['applicationActivity', ApplicationActivity],
  ['boardConfig', BoardConfig],
  ['jobSearchProfiles', JobSearchProfile],
  ['jobSearchRules', JobSearchRule],
  ['scrapedJobs', ScrapedJob],
] as const

export type AccountExport = {
  exportedAt: string
  account: { id: string; name: string | null; email: string | null }
} & Record<string, unknown>

/**
 * Everything the product holds about one user, as plain JSON.
 *
 * Deliberately excludes the Auth.js `accounts` documents. Those carry the
 * OAuth access and refresh tokens for the user's Google or GitHub account, and
 * writing live credentials into a file that then sits in a downloads folder
 * would create a much larger risk than the export solves. Which providers are
 * linked is included; the tokens are not.
 */
export async function exportUserData(
  userId: string,
  profile: { name?: string | null; email?: string | null }
): Promise<AccountExport> {
  await dbConnect()

  const collections = await Promise.all(
    USER_OWNED.map(async ([key, model]) => {
      // `as never` narrows the union of seven distinct Mongoose model types,
      // which TypeScript cannot resolve to one call signature; the filter shape
      // is identical for all of them.
      const docs = await (model as never as typeof Resume).find({ userId }).lean()
      return [key, docs] as const
    })
  )

  const providers = await linkedProviders(userId)

  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: userId,
      name: profile.name ?? null,
      email: profile.email ?? null,
    },
    linkedSignInProviders: providers,
    ...Object.fromEntries(collections),
  }
}

/** Provider names only — never the tokens stored alongside them. */
async function linkedProviders(userId: string): Promise<string[]> {
  const oid = toObjectId(userId)
  if (!oid) return []
  const db = (await clientPromise).db()
  const accounts = await db.collection('accounts').find({ userId: oid }).project({ provider: 1 }).toArray()
  return accounts.map((a) => String(a.provider))
}

export type DeletionSummary = Record<string, number>

/**
 * Deletes the user's data and then the user.
 *
 * **Ordering is deliberate, and it is the safety property here.** MongoDB
 * multi-document transactions need a replica set, which a local standalone
 * mongod is not, and nothing else in this repo uses them — so this is a
 * sequence of deletes, not an atomic one. Given that, app data goes first and
 * the sign-in record goes last: if the sequence fails part-way, the user can
 * still sign in and retry. The opposite order would strand orphaned résumés
 * and applications behind a login that no longer exists, reachable by nobody
 * and deletable by nobody.
 *
 * Returns per-collection counts so the caller can report what actually went,
 * rather than asserting success it did not verify.
 */
export async function deleteUserAccount(userId: string): Promise<DeletionSummary> {
  await dbConnect()

  const summary: DeletionSummary = {}

  for (const [key, model] of USER_OWNED) {
    const res = await (model as never as typeof Resume).deleteMany({ userId })
    summary[key] = res.deletedCount ?? 0
  }

  // The Auth.js adapter's own records, written directly because the adapter
  // exposes no delete path outside a database-session flow and this app uses
  // JWT sessions. `sessions` is swept anyway: it is empty under JWT, but a
  // future switch to database sessions must not silently leave live sessions
  // behind for a deleted account.
  const oid = toObjectId(userId)
  if (oid) {
    const db = (await clientPromise).db()
    summary.linkedAccounts = (await db.collection('accounts').deleteMany({ userId: oid })).deletedCount ?? 0
    summary.sessions = (await db.collection('sessions').deleteMany({ userId: oid })).deletedCount ?? 0
    summary.user = (await db.collection('users').deleteOne({ _id: oid })).deletedCount ?? 0
  }

  return summary
}

/**
 * `session.user.id` is the adapter user's `_id` as a hex string, but it arrives
 * from a JWT and is not re-validated, so a malformed value must not throw its
 * way out of a delete.
 */
function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) ? new ObjectId(id) : null
}

/** Exposed for the test that asserts no user-owned model is left out. */
export const USER_OWNED_KEYS = USER_OWNED.map(([key]) => key)
