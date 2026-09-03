import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

/**
 * Panels that render inside a narrow surface — the editor's tab pane, which is
 * a single full-width column below the `md` breakpoint, and the job-search
 * wizard. Each was measured at 375px in a real browser; a fixed multi-column
 * grid in any of them divides an already-narrow column again.
 */
const NARROW_SURFACE_PANELS = [
  'components/ats/AtsScorePanel.tsx',
  'components/jobsearch/ProfileWizard.tsx',
  'components/jobsearch/ProfileWizardSteps.tsx',
  'components/editor/forms/CustomSectionForm.tsx',
  'components/editor/DesignPanel.tsx',
]

/**
 * A numeric `grid-cols-N` (N >= 2) with no responsive prefix in front of it.
 * `grid-cols-1` is fine, and so are arbitrary tracks like
 * `grid-cols-[auto_1fr]`, whose `1fr` column shrinks on its own.
 */
const UNCONDITIONAL_MULTI_COLUMN = /(?<![a-z0-9:-])grid-cols-[2-9]\b/g

describe('narrow-surface panels stay responsive', () => {
  // These four panels held zero responsive prefixes between them while the
  // marketing site had 45. DesignPanel put two font selects in a fixed two-up
  // grid (162px each at 375px) and CustomSectionForm did the same to a pair of
  // month+year pickers (125px each, narrower than the month select alone
  // wants).
  it.each(NARROW_SURFACE_PANELS)('%s has no unconditional multi-column grid', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8')
    const offenders = [...source.matchAll(UNCONDITIONAL_MULTI_COLUMN)].map((m) => {
      const line = source.slice(0, m.index).split('\n').length
      return `${file}:${line} — ${m[0]}`
    })

    expect(
      offenders,
      `Use "grid-cols-1 sm:grid-cols-${offenders[0]?.slice(-1) ?? 2}" so the panel stacks on a phone.`
    ).toEqual([])
  })
})
