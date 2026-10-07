// Ratchet: counts legacy utility classes per authenticated source file. A file may never
// use MORE than its baseline, and a baseline may never be left higher than reality, so the
// numbers below only ever move down. New files must be clean (absent from BASELINE = 0).
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')
const SCAN_DIRS = ['components', join('app', '(dashboard)')]
// Marketing, sign-in and the Plasma/AppNavbar they use are out of scope for the redesign
// (spec open question 3, plan ruling P1).
const EXCLUDE = [/[\\/]marketing[\\/]/, /ui[\\/]Plasma/, /ui[\\/]AppNavbar/, /\.test\.tsx?$/]

// One regex per rule so a failure names the offending rule.
const RULES: Record<string, RegExp> = {
  'bg-white': /\bbg-white\b/g,
  'text-white': /\btext-white\b/g,
  'off-scale radius': /\brounded-(md|lg|xl|2xl)\b/g,
  'in-flow shadow': /\bshadow-(md|lg|xl|2xl)\b/g,
  'raw accent action': /\bbg-accent-(600|700)\b/g,
  'focus: ring/border': /\bfocus:(border|ring)/g,
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (p.endsWith('.tsx')) out.push(p)
  }
  return out
}

function countHits(src: string): number {
  return Object.values(RULES).reduce((n, re) => n + (src.match(re)?.length ?? 0), 0)
}

// Filled in by Step 2. Keys are repo-relative with forward slashes.
const BASELINE: Record<string, number> = {
  'components/EmptyDashboardState.tsx': 3,
  'components/NewResumeButton.tsx': 8,
  'components/UploadCVButton.tsx': 6,
  'components/UploadProgressModal.tsx': 9,
  'components/ai/AiSuggestButton.tsx': 7,
  'components/ats/AtsFixReviewPanel.tsx': 11,
  'components/ats/AtsScorePanel.tsx': 39,
  'components/ats/StepsBar.tsx': 4,
  'components/coverletter/CoverLetterPanel.tsx': 9,
  'components/editor/AccordionSection.tsx': 5,
  'components/editor/EditTab.tsx': 4,
  'components/editor/EditorErrorBoundary.tsx': 7,
  'components/editor/EditorShell.tsx': 5,
  'components/editor/ExportMenu.tsx': 5,
  'components/editor/PreviewTab.tsx': 2,
  'components/editor/UnverifiedClaimsBanner.tsx': 3,
  'components/editor/design/ColorField.tsx': 4,
  'components/editor/design/ColumnsSection.tsx': 6,
  'components/editor/forms/CustomSectionForm.tsx': 2,
  'components/editor/forms/ListFieldManager.tsx': 1,
  'components/editor/forms/MonthYearPicker.tsx': 2,
  'components/editor/forms/RichTextField.tsx': 7,
  'components/jobsearch/JobSearchShell.tsx': 2,
  'components/jobsearch/ProfileList.tsx': 1,
  'components/jobsearch/ProfileWizard.tsx': 6,
  'components/jobsearch/ProfileWizardSteps.tsx': 5,
  'components/jobsearch/RuleBuilder.tsx': 6,
  'components/pipeline/PipelineInbox.tsx': 2,
  'components/pipeline/ShortcutsHelp.tsx': 3,
  'components/ui/SkipLink.tsx': 4,
}

const actual: Record<string, number> = {}
for (const d of SCAN_DIRS) {
  for (const file of walk(join(ROOT, d))) {
    const rel = relative(ROOT, file).split('\\').join('/')
    if (EXCLUDE.some((re) => re.test(file))) continue
    const n = countHits(readFileSync(file, 'utf8'))
    if (n > 0) actual[rel] = n
  }
}

describe('legacy utility ratchet', () => {
  it('no file uses more legacy utilities than its baseline (new files must be clean)', () => {
    const over = Object.entries(actual).filter(([f, n]) => n > (BASELINE[f] ?? 0))
    expect(over).toEqual([])
  })
  it('no baseline is higher than reality (lower it when you clean a file)', () => {
    const stale = Object.entries(BASELINE).filter(([f, n]) => (actual[f] ?? 0) < n)
    expect(stale).toEqual([])
  })
})
