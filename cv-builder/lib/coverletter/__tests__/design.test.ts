import { describe, it, expect } from 'vitest'
import { LETTER_DESIGNS, defaultDesignFor, resolveDesign } from '../design'

describe('LETTER_DESIGNS', () => {
  it('lists the two designs', () => {
    expect([...LETTER_DESIGNS]).toEqual(['classic', 'accent-edge'])
  })
})

describe('defaultDesignFor', () => {
  it.each(['classic', 'executive', 'minimal', undefined, 'zzz'])('gives classic for %s', (id) => {
    expect(defaultDesignFor(id)).toBe('classic')
  })

  it.each(['modern', 'sidebar'])('gives accent-edge for %s', (id) => {
    expect(defaultDesignFor(id)).toBe('accent-edge')
  })
})

describe('resolveDesign', () => {
  it('keeps an explicit choice over the template', () => {
    expect(resolveDesign('classic', 'modern')).toBe('classic')
  })

  it('follows the template when nothing was chosen', () => {
    expect(resolveDesign(undefined, 'modern')).toBe('accent-edge')
  })
})
