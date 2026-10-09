// scripts/seed-demo.ts
// Populates the CVitae demo account. Run from cv-builder/:
//
//   npx tsx scripts/seed-demo.ts              # dry run: checks the user, prints the plan, writes nothing
//   npx tsx scripts/seed-demo.ts --apply      # first-time seed (refuses if the account has data)
//   npx tsx scripts/seed-demo.ts --apply --reset   # wipe THIS user's data and re-seed
//
// The target account is hard-coded on purpose: there is no flag to point this
// at another user. MONGODB_URI is read from .env.local (or the environment).
import mongoose from 'mongoose'
import { seedDemoUser, SeedAbort } from './demo-seed/seed'

const DEMO_USER_ID = '6ac88905b880e0a741e35ef3'
const DEMO_USER_EMAIL = 'idantest3@gmail.com'

async function main() {
  const args = new Set(process.argv.slice(2))
  const unknown = [...args].filter((a) => !['--apply', '--reset'].includes(a))
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(' ')}. Allowed: --apply, --reset`)
    process.exit(2)
  }

  if (!process.env.MONGODB_URI) {
    try {
      process.loadEnvFile('.env.local')
    } catch {
      // fall through to the check below
    }
  }
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('MONGODB_URI is not set (looked in the environment and .env.local).')
    process.exit(2)
  }

  await mongoose.connect(uri, { maxPoolSize: 2 })
  try {
    const report = await seedDemoUser({
      connection: mongoose.connection,
      userId: DEMO_USER_ID,
      expectedEmail: DEMO_USER_EMAIL,
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
