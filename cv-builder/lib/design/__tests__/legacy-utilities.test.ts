// Ratchet: counts legacy utility classes per source file under components/, app/ and lib/ (.tsx only). A file may never
// use MORE than its baseline, and a baseline may never be left higher than reality, so the
// numbers below only ever move down. New files must be clean (absent from BASELINE = 0).
//
// What a static scan cannot see: class names assembled at runtime, by string concatenation or
// template pieces such as `bg-${tone}-500`, or looked up from a variable. Those never appear as
// a literal token in the source, so reviewers must check them by eye.
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
    /\b(?:bg|text|border|ring|fill|stroke)-(?:(?:neutral|gray|slate|zinc|stone|red|orange|amber|yellow|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|danger|success|warning)-\d+|(?:black|white)\/\d+)/g,
  'inline accent var': /rgb\(var\(--color-accent-\d+\)/g,
  'focus: ring/border': /\bfocus:(border|ring)/g,
  'arbitrary text size': /\btext-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
  'extra off-scale radius':
    /\brounded-(?:sm|3xl)\b|\brounded-(?:t|r|b|l|s|e|tl|tr|bl|br|ss|se|es|ee)-(?:sm|md|lg|xl|2xl|3xl)\b/g,
  'bare shadow': /(?<![\w-])shadow(?:-inner)?(?![\w-])/g,
  'inline heavy weight': /fontWeight:\s*(?:[6-9]\d\d|['"`](?:bold|semibold|[6-9]00)['"`])/g,
  'inline literal shadow': /boxShadow:\s*['"`](?!none|var|[^'"`]*var\()/g,
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p)
  }
  return out
}

// Rules that do not apply to the document renderers: the live-preview templates, the PDF templates
// and the OG image style a résumé or a share card with literal font weights (react-pdf and satori
// take no Tailwind classes, and the preview must match the PDF), so they are not app UI.
const RULE_SKIP: Record<string, RegExp> = {
  'inline heavy weight': /^(?:components\/templates\/|lib\/pdf\/|app\/opengraph-image\.tsx$)/,
}

function breakdown(src: string, rel: string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [name, re] of Object.entries(RULES)) {
    if (RULE_SKIP[name]?.test(rel)) continue
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
  // kept: the danger variant has no semantic action-fill token (only fg-danger, surface-danger and border-danger exist), so it uses the danger palette steps directly.
  'components/ui/Button.tsx': 2,
  // kept: the single allowed active-segment shadow-sm, the one raised surface a segmented control is meant to have.
  'components/editor/design/SegmentedControl.tsx': 1,
  // kept: cleared by the type-scale task in this PR
  'components/applications/ApplicationsBoard.tsx': 1,
  // kept: cleared by the type-scale task in this PR
  'components/applications/ColumnHeader.tsx': 3,
  // kept: cleared by the type-scale task in this PR
  'components/ats/StepsBar.tsx': 1,
  // kept: cleared by the type-scale task in this PR
  'components/editor/EditTab.tsx': 1,
  // kept: cleared by the type-scale task in this PR
  'components/editor/ExportMenu.tsx': 1,
  // kept: cleared by the type-scale task in this PR
  'components/jobsearch/JobSearchShell.tsx': 1,
  // kept: cleared by the type-scale task in this PR
  'components/jobsearch/ProfileList.tsx': 3,
  // kept: cleared by the type-scale task in this PR
  'components/jobsearch/ProfileSettings.tsx': 1,
  // kept: cleared by the type-scale task in this PR
  'components/jobsearch/ProfileWizardSteps.tsx': 3,
  // kept: cleared by the type-scale task in this PR
  'components/marketing/JobSearchSection.tsx': 1,
}

// Returns the baseline entries ('path': N, with N > 0) whose previous non-empty line is not a `// kept:` comment.
export function undocumentedEntries(src: string): string[] {
  const lines = src.split('\n')
  const out: string[] = []
  lines.forEach((line, i) => {
    const m = line.match(/^\s*['"]([^'"]+)['"]\s*:\s*(\d+)\s*,?\s*(\/\/.*)?$/)
    if (!m || Number(m[2]) === 0) return
    let j = i - 1
    while (j >= 0 && lines[j].trim() === '') j--
    if (j < 0 || !lines[j].trim().startsWith('// kept:')) out.push(m[1])
  })
  return out
}

const actual: Record<string, number> = {}
const detail: Record<string, string> = {}
for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const rel = relative(ROOT, file).split('\\').join('/')
    if (EXCLUDE.some((re) => re.test(rel))) continue
    // lib carries UI classes only in .tsx components; its .ts files are logic and data.
    if (rel.startsWith('lib/') && !rel.endsWith('.tsx')) continue
    const b = breakdown(readFileSync(file, 'utf8'), rel)
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
  it('every non-zero BASELINE entry carries a kept: comment', () => {
    // Scope the scan to the BASELINE literal so the synthetic strings below are not picked up.
    const src = readFileSync(__filename, 'utf8')
    const start = src.indexOf('const BASELINE')
    const end = src.indexOf('\n}\n', start)
    expect(start).toBeGreaterThan(-1)
    expect(end).toBeGreaterThan(start)
    expect(undocumentedEntries(src.slice(start, end))).toEqual([])
  })
  it('undocumentedEntries flags an entry without a kept: comment', () => {
    const documented = ["{", "  // kept: reason", "  'a/b.tsx': 1,", "}"].join('\n')
    const bare = ["{", "  'a/b.tsx': 1,", "  'c/d.tsx': 2,", "}"].join('\n')
    expect(undocumentedEntries(documented)).toEqual([])
    expect(undocumentedEntries(bare)).toEqual(['a/b.tsx', 'c/d.tsx'])
  })
  it('undocumentedEntries also catches a last entry without a comma, double-quoted keys and trailing comments', () => {
    expect(undocumentedEntries(['{', "  'a/b.tsx': 1", '}'].join('\n'))).toEqual(['a/b.tsx'])
    expect(undocumentedEntries(['{', '  "a/b.tsx": 1,', '}'].join('\n'))).toEqual(['a/b.tsx'])
    expect(undocumentedEntries(['{', "  'a/b.tsx': 1, // why", '}'].join('\n'))).toEqual(['a/b.tsx'])
    expect(undocumentedEntries(['{', '  // kept: ok', '  "a/b.tsx": 1 // note', '}'].join('\n'))).toEqual([])
  })
})
