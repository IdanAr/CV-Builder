import { describe, it, expect } from 'vitest'

describe('redirect-only jobsearch segments', () => {
  it.each(['./[id]/loading', './notifications/loading'])('%s renders nothing', async (path) => {
    const { default: Loading } = await import(path)
    expect(Loading()).toBeNull()
  })
})
