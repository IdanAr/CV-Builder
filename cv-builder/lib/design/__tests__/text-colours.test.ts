import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')
const SCAN_DIRS = ['app', 'components', 'lib']
// Marketing and live-preview templates carry their own palettes.
const EXCLUDED = [/components[\\/]marketing[\\/]/, /components[\\/]templates[\\/]/, /__tests__[\\/]/, /\.test\.tsx?$/]

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      sourceFiles(full, out)
    } else if (/\.(tsx?|css)$/.test(entry.name) && !EXCLUDED.some((re) => re.test(full))) {
      out.push(full)
    }
  }
  return out
}

describe('neutral text colours', () => {
  it('never tints headings with the cobalt scale (accent-900 / accent-950 text)', () => {
    // Pattern built from parts so this file does not match itself.
    const banned = new RegExp(['text', 'accent', '(?:900|950)'].join('-'))
    const offenders = SCAN_DIRS.flatMap((d) => sourceFiles(join(ROOT, d)))
      .filter((f) => banned.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f))
    expect(offenders).toEqual([])
  })
})
