import { describe, it, expect } from 'vitest'
import { TEMPLATE_OPTIONS, templateLabel } from '../templates'

describe('templates', () => {
  it('lists the five templates with their labels', () => {
    expect(TEMPLATE_OPTIONS.map((t) => t.id)).toEqual(['classic', 'modern', 'minimal', 'executive', 'sidebar'])
    expect(templateLabel('executive')).toBe('Executive')
  })
  it('falls back to Classic for unknown or missing ids', () => {
    expect(templateLabel(undefined)).toBe('Classic')
    expect(templateLabel('zzz')).toBe('Classic')
  })
})
