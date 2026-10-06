import { describe, it, expect } from 'vitest'
import config from '../../../tailwind.config'

describe('UI typography', () => {
  const families = (config.theme?.extend as { fontFamily?: Record<string, string[]> })?.fontFamily

  it('uses Geist Sans for the sans stack', () => {
    expect(families?.sans?.[0]).toBe('var(--font-geist-sans)')
  })

  it('uses Geist Mono for the mono stack', () => {
    expect(families?.mono?.[0]).toBe('var(--font-geist-mono)')
  })

  it('keeps a system fallback in both stacks', () => {
    expect(families?.sans).toContain('system-ui')
    expect(families?.mono).toContain('ui-monospace')
  })
})
