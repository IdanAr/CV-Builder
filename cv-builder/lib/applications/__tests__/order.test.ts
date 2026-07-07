import { describe, it, expect } from 'vitest'
import { computeMovedOrder } from '../order'

const items = [
  { id: 'a', order: 1000 },
  { id: 'b', order: 2000 },
  { id: 'c', order: 3000 },
  { id: 'd', order: 4000 },
]

describe('computeMovedOrder', () => {
  it('moving down lands at the midpoint below the target', () => {
    // a moved onto c: a takes c's slot, landing between c and d
    expect(computeMovedOrder(items, 'a', 'c')).toBe(3500)
  })

  it('moving up lands at the midpoint above the target', () => {
    // d moved onto b: lands between a and b
    expect(computeMovedOrder(items, 'd', 'b')).toBe(1500)
  })

  it('moving to the very top goes below the first order value', () => {
    expect(computeMovedOrder(items, 'c', 'a')).toBe(0)
  })

  it('moving to the very bottom appends past the last order value', () => {
    expect(computeMovedOrder(items, 'a', 'd')).toBe(5000)
  })

  it('adjacent swap down works', () => {
    // a onto b: lands between b and c
    expect(computeMovedOrder(items, 'a', 'b')).toBe(2500)
  })

  it('returns null for a no-op (dropped on itself) or unknown ids', () => {
    expect(computeMovedOrder(items, 'a', 'a')).toBeNull()
    expect(computeMovedOrder(items, 'zzz', 'a')).toBeNull()
    expect(computeMovedOrder(items, 'a', 'zzz')).toBeNull()
  })

  it('works on unsorted input (sorts by order internally)', () => {
    const shuffled = [items[2], items[0], items[3], items[1]]
    expect(computeMovedOrder(shuffled, 'a', 'c')).toBe(3500)
  })
})
