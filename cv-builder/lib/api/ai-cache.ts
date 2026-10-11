// lib/api/ai-cache.ts
// Per-user cache of AI results that should not change between runs on the
// same input (the keyword list of a job description, the synonym matches of
// an unchanged CV). Best effort: a failed read or write is logged and treated
// as a miss, so the cache can never fail the request it sits in front of.
import { createHash } from 'node:crypto'
import dbConnect from '@/lib/db'
import AiCache from '@/models/AiCache'

export type AiCacheKind = 'jd-requirements' | 'synonym-matches'

/**
 * Hashes the parts that decide an AI result. Callers put their prompt
 * version first, so changing a prompt invalidates old entries without a
 * migration. Whitespace is collapsed so a re-paste of the same text hits.
 */
export function aiCacheKey(...parts: string[]): string {
  const normalized = parts.map((p) => p.replace(/\s+/g, ' ').trim())
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

export async function readAiCache<T>(userId: string, kind: AiCacheKind, key: string): Promise<T | null> {
  try {
    await dbConnect()
    const hit = await AiCache.findOne({ userId, kind, key }).lean<{ value: T }>()
    return hit ? hit.value : null
  } catch (err) {
    console.error(`readAiCache(${kind}) failed, treating as a miss`, err)
    return null
  }
}

export async function writeAiCache(userId: string, kind: AiCacheKind, key: string, value: unknown): Promise<void> {
  try {
    await dbConnect()
    await AiCache.updateOne(
      { userId, kind, key },
      { $set: { value, createdAt: new Date() } },
      { upsert: true },
    )
  } catch (err) {
    console.error(`writeAiCache(${kind}) failed`, err)
  }
}
