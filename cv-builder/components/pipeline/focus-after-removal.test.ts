import { describe, it, expect } from 'vitest'
import { planFocusAfterRemoval } from './focus-after-removal'

const pending = { removed: 'b', fallbacks: ['c', 'a'] }

describe('planFocusAfterRemoval', () => {
  it('waits while the removed row is still listed', () => {
    expect(planFocusAfterRemoval(pending, ['a', 'b', 'c'], false)).toEqual({ kind: 'wait' })
  })
  it('waits while a job is open (the list is hidden below lg), then applies once it clears', () => {
    expect(planFocusAfterRemoval(pending, ['a', 'c'], true)).toEqual({ kind: 'wait' })
    expect(planFocusAfterRemoval(pending, ['a', 'c'], false)).toEqual({ kind: 'row', id: 'c' })
  })
  it('falls back to the previous row, then the list', () => {
    expect(planFocusAfterRemoval(pending, ['a'], false)).toEqual({ kind: 'row', id: 'a' })
    expect(planFocusAfterRemoval(pending, [], false)).toEqual({ kind: 'list' })
  })
})
