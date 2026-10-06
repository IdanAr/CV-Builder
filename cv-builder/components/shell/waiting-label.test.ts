import { describe, it, expect } from 'vitest'
import { waitingLabel } from './waiting-label'

describe('waitingLabel', () => {
  it.each([
    [0, ''],
    [-2, ''],
    [1, '1 item waiting'],
    [7, '7 items waiting'],
    [99, '99 items waiting'],
    [140, '99+ items waiting'],
  ])('labels %i as %j', (count, expected) => {
    expect(waitingLabel(count)).toBe(expected)
  })
})
