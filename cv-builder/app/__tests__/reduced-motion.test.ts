import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(__dirname, '..', 'globals.css'), 'utf8')
const tsx = readFileSync(join(__dirname, '..', '..', 'components', 'ats', 'AtsScorePanel.tsx'), 'utf8')

describe('reduced motion', () => {
  it('globals.css neutralises transitions and animations under prefers-reduced-motion', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*{[\s\S]*?\n}/)?.[0] ?? ''
    expect(block).toMatch(/animation-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/transition-duration:\s*0\.01ms\s*!important/)
    expect(block).toMatch(/animation-iteration-count:\s*1\s*!important/)
    expect(block).toMatch(/scroll-behavior:\s*auto\s*!important/)
  })
  it('no bare animate-spin remains in AtsScorePanel', () => {
    expect(tsx.match(/(?<!motion-safe:)\banimate-spin\b/g)).toBeNull()
  })
})
