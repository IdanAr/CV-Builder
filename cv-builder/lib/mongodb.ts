import { MongoClient } from 'mongodb'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is not defined')
}

declare global {
  var __mongoClientPromise: Promise<MongoClient> | undefined
}

// Matches MAX_POOL_SIZE in lib/db.ts. This is the second of the two pools a
// warm serverless instance holds (this one backs the Auth.js adapter), so
// leaving the driver default of 100 here would undo the cap set there.
const MAX_POOL_SIZE = 10

let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === 'development') {
  if (!global.__mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI, { maxPoolSize: MAX_POOL_SIZE })
    global.__mongoClientPromise = client.connect()
  }
  clientPromise = global.__mongoClientPromise
} else {
  const client = new MongoClient(MONGODB_URI, { maxPoolSize: MAX_POOL_SIZE })
  clientPromise = client.connect()
}

export default clientPromise
