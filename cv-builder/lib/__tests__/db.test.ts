// Guards the connection-cache behaviour of lib/db.ts.
//
// The retry test below is the one that matters: before the fix, a rejected
// `mongoose.connect` stayed in `cached.promise` forever, so every subsequent
// request on that warm serverless instance re-awaited the same rejection and
// failed instantly — one transient Atlas blip turned into a sticky outage
// until the container recycled. Nothing else in the suite covers this file.
import { describe, it, expect, vi, beforeEach } from 'vitest'

const connect = vi.fn()

vi.mock('mongoose', () => ({
  default: {
    connect: (...args: unknown[]) => connect(...args),
  },
}))

// lib/db.ts caches on `globalThis` and reads MONGODB_URI at module scope, so
// each test needs a fresh module registry and a cleared cache to be honest.
async function freshDbConnect() {
  vi.resetModules()
  delete (globalThis as Record<string, unknown>).__mongoose
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db-unit-test'
  const mod = await import('@/lib/db')
  return mod.default
}

beforeEach(() => {
  connect.mockReset()
})

describe('dbConnect', () => {
  it('retries the connection after a failure instead of caching the rejection', async () => {
    const connection = { tag: 'connected' }
    connect.mockRejectedValueOnce(new Error('transient atlas failure')).mockResolvedValueOnce(connection)

    const dbConnect = await freshDbConnect()

    await expect(dbConnect()).rejects.toThrow('transient atlas failure')

    // The assertion that encodes the bug: without clearing cached.promise this
    // second call re-awaits the first rejection and never reaches mongoose.
    await expect(dbConnect()).resolves.toBe(connection)
    expect(connect).toHaveBeenCalledTimes(2)
  })

  it('bounds the connection pool so two pools per instance cannot exhaust Atlas', async () => {
    connect.mockResolvedValue({ tag: 'connected' })

    const dbConnect = await freshDbConnect()
    await dbConnect()

    expect(connect).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ maxPoolSize: 10, bufferCommands: false })
    )
  })

  it('reuses an established connection rather than dialling per call', async () => {
    connect.mockResolvedValue({ tag: 'connected' })

    const dbConnect = await freshDbConnect()
    const first = await dbConnect()
    const second = await dbConnect()

    expect(second).toBe(first)
    expect(connect).toHaveBeenCalledTimes(1)
  })
})
