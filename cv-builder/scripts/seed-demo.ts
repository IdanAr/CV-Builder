// scripts/seed-demo.ts
// Populates the CVitae demo account. Run from cv-builder/:
//
//   npx tsx scripts/seed-demo.ts              # dry run: checks the user, prints the plan, writes nothing
//   npx tsx scripts/seed-demo.ts --apply      # first-time seed (refuses if the account has data)
//   npx tsx scripts/seed-demo.ts --apply --reset   # wipe THIS user's data and re-seed
//
// The target account comes from DEMO_USER_ID and DEMO_USER_EMAIL in
// .env.local (kept out of this public repo), and both must match the same
// user in the database. There is no command-line flag to point it at anyone
// else. MONGODB_URI is read from the same file (or the environment).
import mongoose from 'mongoose'
import { seedDemoUser, SeedAbort } from './demo-seed/seed'

async function main() {
  const args = new Set(process.argv.slice(2))
  const unknown = [...args].filter((a) => !['--apply', '--reset'].includes(a))
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(' ')}. Allowed: --apply, --reset`)
    process.exit(2)
  }

  if (!process.env.MONGODB_URI || !process.env.DEMO_USER_ID || !process.env.DEMO_USER_EMAIL) {
    try {
      process.loadEnvFile('.env.local')
    } catch {
      // fall through to the check below
    }
  }
  const uri = process.env.MONGODB_URI
  const DEMO_USER_ID = process.env.DEMO_USER_ID
  const DEMO_USER_EMAIL = process.env.DEMO_USER_EMAIL
  const missing = Object.entries({ MONGODB_URI: uri, DEMO_USER_ID, DEMO_USER_EMAIL })
    .filter(([, v]) => !v)
    .map(([k]) => k)
  if (missing.length > 0) {
    console.error(`Missing ${missing.join(', ')} (looked in the environment and .env.local).`)
    process.exit(2)
  }

  await mongoose.connect(uri!, { maxPoolSize: 2 })
  try {
    const report = await seedDemoUser({
      connection: mongoose.connection,
      userId: DEMO_USER_ID!,
      expectedEmail: DEMO_USER_EMAIL!,
      apply: args.has('--apply'),
      reset: args.has('--reset'),
      log: (line) => console.log(line),
    })
    console.log(report.applied ? 'Done.' : 'Dry run complete.')
  } catch (err) {
    if (err instanceof SeedAbort) {
      console.error(`Aborted: ${err.message}`)
      process.exitCode = 1
    } else {
      throw err
    }
  } finally {
    await mongoose.disconnect()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
