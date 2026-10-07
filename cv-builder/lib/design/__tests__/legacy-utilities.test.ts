// Ratchet: counts legacy utility classes per source file under components/, app/ and lib/ (.tsx only). A file may never
// use MORE than its baseline, and a baseline may never be left higher than reality, so the
// numbers below only ever move down. New files must be clean (absent from BASELINE = 0).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')
const SCAN_DIRS = ['components', 'app', 'lib']
// Matched against the repo-relative path (forward slashes). Plasma is a WebGL effect with its
// own palette; tests and API routes carry no UI classes.
const EXCLUDE = [/^components\/ui\/Plasma/, /\.test\.tsx?$/, /(^|\/)__tests__\//, /^app\/api\//, /^lib\/design\//]

// One regex per rule so a failure names the offending rule.
const RULES: Record<string, RegExp> = {
  'bg-white': /\bbg-white\b/g,
  'text-white': /\btext-white\b/g,
  'off-scale radius': /\brounded-(md|lg|xl|2xl)\b/g,
  'off-scale shadow': /\bshadow-(sm|md|lg|xl|2xl)\b/g,
  'any accent utility':
    /\b(?:bg|text|border|ring|from|to|via|divide|outline|fill|stroke|decoration|placeholder)-accent-\d+(?:\/\d+)?/g,
  'bare radius': /(?<![\w-])rounded(?![\w-])/g,
  'heavy weight': /\bfont-(semibold|bold|extrabold|black)\b/g,
  gradient: /\bbg-gradient-to-\w+|\b(?:from|via|to)-(?!transparent\b)[a-z]+-\d+/g,
  'raw palette':
    /\b(?:bg|text|border|ring|fill|stroke)-(?:neutral|gray|slate|zinc|stone|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d+/g,
  'inline accent var': /rgb\(var\(--color-accent-\d+\)/g,
  'focus: ring/border': /\bfocus:(border|ring)/g,
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p)
  }
  return out
}

function breakdown(src: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [name, re] of Object.entries(RULES)) {
    const n = src.match(re)?.length ?? 0
    if (n > 0) out[name] = n
  }
  return out
}

const fmt = (b: Record<string, number>) =>
  Object.entries(b)
    .map(([k, n]) => `${k}: ${n}`)
    .join(', ')

// Keys are repo-relative with forward slashes. Copy counts from the test output; never hand-edit.
const BASELINE: Record<string, number> = {
  'app/(auth)/signin/page.tsx': 24,
  'app/privacy/page.tsx': 36,
  'app/terms/page.tsx': 34,
  'components/editor/design/SegmentedControl.tsx': 1,
  'components/marketing/FaqSection.tsx': 8,
  'components/marketing/FeaturesSection.tsx': 12,
  'components/marketing/FinalCtaSection.tsx': 13,
  'components/marketing/HeroSection.tsx': 30,
  'components/marketing/HowItWorksSection.tsx': 10,
  'components/marketing/JobSearchSection.tsx': 34,
  'components/marketing/LegalPageShell.tsx': 8,
  'components/marketing/MarketingFooter.tsx': 12,
  'components/marketing/MarketingNavActions.tsx': 16,
  'components/marketing/TemplateThumbnail.tsx': 3,
  'components/marketing/TemplatesShowcaseSection.tsx': 9,
  'components/marketing/TestimonialsSection.tsx': 13,
  'components/ui/AppNavbar.tsx': 1,
}

const actual: Record<string, number> = {}
const detail: Record<string, string> = {}
for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const rel = relative(ROOT, file).split('\\').join('/')
    if (EXCLUDE.some((re) => re.test(rel))) continue
    // lib carries UI classes only in .tsx components; its .ts files are logic and data.
    if (rel.startsWith('lib/') && !rel.endsWith('.tsx')) continue
    const b = breakdown(readFileSync(file, 'utf8'))
    const n = Object.values(b).reduce((x, y) => x + y, 0)
    if (n > 0) {
      actual[rel] = n
      detail[rel] = fmt(b)
    }
  }
}

describe('legacy utility ratchet', () => {
  it('no file uses more legacy utilities than its baseline (new files must be clean)', () => {
    const over = Object.entries(actual)
      .filter(([f, n]) => n > (BASELINE[f] ?? 0))
      .map(([f, n]) => [f, n, detail[f]])
    expect(over).toEqual([])
  })
  it('no baseline is higher than reality (lower it when you clean a file)', () => {
    const stale = Object.entries(BASELINE)
      .filter(([f, n]) => (actual[f] ?? 0) < n)
      .map(([f, n]) => [f, n, `now ${actual[f] ?? 0}`])
    expect(stale).toEqual([])
  })
})
