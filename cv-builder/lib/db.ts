import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined')
}

interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var __mongoose: MongooseCache | undefined
}

const cached: MongooseCache = global.__mongoose ?? { conn: null, promise: null }
global.__mongoose = cached

// Mongoose defaults to a pool of 100 per connection, and this app opens a
// second, independent pool in lib/mongodb.ts for the Auth.js adapter. On
// Vercel every warm instance holds both, so the default multiplies across
// concurrent instances and reaches an Atlas connection ceiling long before
// the user count gets interesting. A serverless instance serves very few
// requests at once, so 10 is already generous.
const MAX_POOL_SIZE = 10

export default async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) return cached.conn

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI as string, {
      bufferCommands: false,
      maxPoolSize: MAX_POOL_SIZE,
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (err) {
    // Without this the rejected promise stays cached forever: every later
    // request on this warm instance re-awaits the same rejection and fails
    // instantly, so one transient Atlas blip becomes a sticky outage for
    // everyone routed to this container until it recycles. Clearing it lets
    // the next call retry the connection.
    cached.promise = null
    throw err
  }
  return cached.conn
}
