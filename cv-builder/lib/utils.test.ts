import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('joins truthy class names with spaces', () => {
    expect(cn('a', 'b', false && 'c', undefined, 'd')).toBe('a b d')
  })

  it('lets a later conflicting Tailwind class win over an earlier one', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('lets a later custom radius override an earlier one', () => {
    expect(cn('rounded-chip', 'rounded-control')).toBe('rounded-control')
    expect(cn('rounded-card', 'rounded-full')).toBe('rounded-full')
    expect(cn('rounded-full', 'rounded-card')).toBe('rounded-card')
  })

  it('keeps unrelated classes and still merges built-ins', () => {
    expect(cn('rounded-card border', 'rounded-overlay')).toBe('border rounded-overlay')
  })

  it('lets a later shadow override shadow-popover and the reverse', () => {
    expect(cn('shadow-popover', 'shadow-sm')).toBe('shadow-sm')
    expect(cn('shadow-sm', 'shadow-popover')).toBe('shadow-popover')
  })

  it('does not treat text colour tokens as font sizes', () => {
    expect(cn('text-sm', 'text-fg-muted')).toBe('text-sm text-fg-muted')
    expect(cn('text-fg-muted', 'text-fg-heading')).toBe('text-fg-heading')
  })
})
