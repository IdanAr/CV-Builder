// test/mongo-memory.ts
// Boots a real (ephemeral, in-memory) single-node MongoDB replica set for
// tests that need genuine Mongoose write-casting or transaction behavior —
// the mocked-Mongoose unit tests used elsewhere in this codebase cannot
// observe either of those (see docs/superpowers/plans/2026-08-31-top-5-confirmed-bug-fixes.md).
import mongoose from 'mongoose'
import { MongoMemoryReplSet } from 'mongodb-memory-server'

let replSet: MongoMemoryReplSet | null = null

/**
 * Connects the real mongoose singleton to an in-memory replica set and
 * pre-seeds the global connection cache that `lib/db.ts`'s `dbConnect()`
 * reads, so production data-access functions (patchResume, patchApplication,
 * ...) exercise this connection instead of trying to reach MONGODB_URI.
 */
export async function connectMemoryMongo(): Promise<void> {
  process.env.MONGODB_URI = 'mongodb://memory-server-placeholder/test'
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } })
  await mongoose.connect(replSet.getUri())

  const g = globalThis as unknown as {
    __mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
  }
  if (!g.__mongoose) g.__mongoose = { conn: null, promise: null }
  g.__mongoose.conn = mongoose
  g.__mongoose.promise = Promise.resolve(mongoose)
}

export async function disconnectMemoryMongo(): Promise<void> {
  await mongoose.disconnect()
  await replSet?.stop()
  replSet = null
  const g = globalThis as unknown as { __mongoose?: unknown }
  delete g.__mongoose
}

/** Empties every collection between tests without re-booting the server. */
export async function clearMemoryMongo(): Promise<void> {
  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({})
  }
}
