import { describe, it, expect } from 'vitest'
import { resolveProfiles } from '../basics-profiles'

describe('resolveProfiles', () => {
  it('returns profiles unchanged when non-empty, ignoring legacy url', () => {
    const result = resolveProfiles({ profiles: [{ id: 'p1', url: 'https://a.dev' }], url: 'https://legacy.dev' })
    expect(result).toEqual([{ id: 'p1', url: 'https://a.dev' }])
  })

  it('falls back to a single legacy-url entry when profiles is empty and url is set', () => {
    const result = resolveProfiles({ url: 'https://legacy.dev' })
    expect(result).toEqual([{ id: 'legacy-url', url: 'https://legacy.dev' }])
  })

  it('falls back when profiles is an empty array', () => {
    const result = resolveProfiles({ profiles: [], url: 'https://legacy.dev' })
    expect(result).toEqual([{ id: 'legacy-url', url: 'https://legacy.dev' }])
  })

  it('returns an empty array when neither profiles nor url is set', () => {
    expect(resolveProfiles({})).toEqual([])
    expect(resolveProfiles(undefined)).toEqual([])
  })
})
