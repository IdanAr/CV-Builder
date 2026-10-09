// scripts/demo-seed/seed.ts
// Writes the demo documents for exactly one user, with guards sized for a
// database that real users share:
//
//   1. The target user must exist in Auth.js's `users` collection AND carry
//      the expected email. A mistyped id cannot land data on someone else.
//   2. Every read, delete and insert is filtered/stamped with that one userId,
//      and each delete filter is asserted to be exactly `{ userId }` first.
//   3. Dry run by default. Nothing is written without `apply: true`.
//   4. Refuses to write into an account that already has data unless `reset`
//      is set, so a second run never doubles the demo data silently.
//   5. Counts every OTHER user's documents before and after and reports a
//      mismatch loudly, as evidence the run touched nobody else.
//
// The connection is passed in, so this runs unchanged against Atlas (via
// scripts/seed-demo.ts) and against an in-memory server in tests.
import { Types, type Connection } from 'mongoose'
import Resume from '@/models/Resume'
import Application from '@/models/Application'
import ApplicationActivity from '@/models/ApplicationActivity'
import BoardConfig from '@/models/BoardConfig'
import JobSearchProfile from '@/models/JobSearchProfile'
import JobSearchRule from '@/models/JobSearchRule'
import ScrapedJob from '@/models/ScrapedJob'
import { buildDemoDocuments, type DemoDocuments } from './build'
import { loadDemoResumes, type DemoResume } from './resumes'

// Same set lib/api/account.ts deletes on account deletion: every collection
// that holds per-user app data.
// The models are distinct types; only constructor + collection name are used,
// which every one of them shares, so they are viewed through one shape (the
// same narrowing lib/api/account.ts does).
type AnyModel = typeof Resume
const as = (m: unknown) => m as AnyModel
const COLLECTIONS: Array<[keyof DemoDocuments, AnyModel]> = [
  ['resumes', Resume],
  ['applications', as(Application)],
  ['applicationActivities', as(ApplicationActivity)],
  ['boardConfigs', as(BoardConfig)],
  ['jobSearchProfiles', as(JobSearchProfile)],
  ['jobSearchRules', as(JobSearchRule)],
  ['scrapedJobs', as(ScrapedJob)],
]

export interface SeedOptions {
  connection: Connection
  userId: string
  expectedEmail: string
  apply: boolean
  reset: boolean
  now?: Date
  log?: (line: string) => void
  /** Overrides the résumé content (tests). Default: demo-content.local.json if present, else the committed samples. */
  resumes?: DemoResume[]
}

export interface SeedReport {
  applied: boolean
  existing: Record<string, number>
  deleted: Record<string, number>
  inserted: Record<string, number>
  otherUsersBefore: Record<string, number>
  otherUsersAfter: Record<string, number>
}

export class SeedAbort extends Error {}

function collectionFor(connection: Connection, model: AnyModel) {
  return connection.db!.collection(model.collection.collectionName)
}

/** Runs each built doc through its Mongoose schema so type/enum/maxlength errors fail before any write. */
async function validateAll(docs: DemoDocuments) {
  for (const [key, model] of COLLECTIONS) {
    for (const doc of docs[key]) {
      try {
        await new model(doc).validate()
      } catch (err) {
        throw new SeedAbort(`Invalid ${key} document: ${(err as Error).message}`)
      }
    }
  }
}

export async function seedDemoUser(opts: SeedOptions): Promise<SeedReport> {
  const { connection, userId, expectedEmail, apply, reset } = opts
  const log = opts.log ?? (() => {})
  const db = connection.db
  if (!db) throw new SeedAbort('Not connected')

  // --- Guard 1: the user exists and is who we think it is -------------------
  if (!Types.ObjectId.isValid(userId) || String(new Types.ObjectId(userId)) !== userId) {
    throw new SeedAbort(`"${userId}" is not a valid ObjectId`)
  }
  const user = await db.collection('users').findOne({ _id: new Types.ObjectId(userId) })
  if (!user) throw new SeedAbort(`No user with _id ${userId} in database "${db.databaseName}"`)
  if (String(user.email ?? '').toLowerCase() !== expectedEmail.toLowerCase()) {
    throw new SeedAbort(`User ${userId} has email "${user.email}", expected "${expectedEmail}". Refusing.`)
  }
  log(`Target user ok: ${userId} <${user.email}> in database "${db.databaseName}"`)

  let resumes = opts.resumes
  if (!resumes) {
    const loaded = loadDemoResumes()
    resumes = loaded.resumes
    log(
      loaded.source === 'local'
        ? 'CV content: demo-content.local.json (your local file)'
        : 'CV content: committed fictional samples (no demo-content.local.json found)'
    )
  }
  const docs = buildDemoDocuments(userId, resumes, opts.now)
  await validateAll(docs)

  const scope = { userId }
  const others = { userId: { $ne: userId } }
  const report: SeedReport = {
    applied: false,
    existing: {},
    deleted: {},
    inserted: {},
    otherUsersBefore: {},
    otherUsersAfter: {},
  }

  for (const [key, model] of COLLECTIONS) {
    const coll = collectionFor(connection, model)
    report.existing[key] = await coll.countDocuments(scope)
    report.otherUsersBefore[key] = await coll.countDocuments(others)
  }

  const existingTotal = Object.values(report.existing).reduce((a, b) => a + b, 0)
  log(`Existing demo-user docs: ${JSON.stringify(report.existing)}`)
  log(`Planned inserts: ${JSON.stringify(Object.fromEntries(COLLECTIONS.map(([k]) => [k, docs[k].length])))}`)

  // --- Guard 4: don't double-seed ---------------------------------------------
  if (existingTotal > 0 && !reset) {
    throw new SeedAbort(
      `User already has ${existingTotal} document(s). Re-run with --reset to wipe this user's data first.`
    )
  }

  if (!apply) {
    log('Dry run: nothing written. Re-run with --apply to write.')
    report.otherUsersAfter = { ...report.otherUsersBefore }
    return report
  }

  // --- Guard 2: deletes are scoped to exactly this user ------------------------
  if (reset) {
    for (const [key, model] of COLLECTIONS) {
      const filter = { userId }
      if (Object.keys(filter).length !== 1 || filter.userId !== userId) {
        throw new SeedAbort('Delete filter is not scoped to the demo user')
      }
      const res = await collectionFor(connection, model).deleteMany(filter)
      report.deleted[key] = res.deletedCount ?? 0
    }
    log(`Deleted: ${JSON.stringify(report.deleted)}`)
  }

  for (const [key, model] of COLLECTIONS) {
    const batch = docs[key]
    if (batch.some((d) => d.userId !== userId)) throw new SeedAbort(`A ${key} document is not stamped with the demo user`)
    if (batch.length === 0) continue
    // Native insert (not Model.create) so the backdated createdAt/updatedAt
    // survive; Mongoose timestamps would overwrite them with "now".
    const res = await collectionFor(connection, model).insertMany(batch)
    report.inserted[key] = res.insertedCount
  }
  report.applied = true
  log(`Inserted: ${JSON.stringify(report.inserted)}`)

  // --- Guard 5: nobody else was touched -----------------------------------
  for (const [key, model] of COLLECTIONS) {
    report.otherUsersAfter[key] = await collectionFor(connection, model).countDocuments(others)
  }
  const drift = COLLECTIONS.filter(([k]) => report.otherUsersAfter[k] !== report.otherUsersBefore[k]).map(([k]) => k)
  if (drift.length > 0) {
    // Other users' counts can legitimately move while the live site is in use,
    // so this is a loud warning to check, not proof of a bad write.
    log(`WARNING: other users' document counts changed during the run in: ${drift.join(', ')}`)
  } else {
    log("Other users' document counts unchanged.")
  }

  return report
}
