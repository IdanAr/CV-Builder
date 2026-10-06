// One-off: moves raw Tailwind colour utilities onto the design tokens.
//   node scripts/codemods/raw-colors-to-tokens.mjs --dry   (report only)
//   node scripts/codemods/raw-colors-to-tokens.mjs         (write)
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const DRY = process.argv.includes('--dry')

const SCOPES = ['components', 'app/(dashboard)']
const EXCLUDE = ['components/marketing']

const FAMILY = { indigo: 'accent', gray: 'neutral', red: 'danger', green: 'success', amber: 'warning' }
const REVIEW = { yellow: 'warning', purple: 'accent', violet: 'accent', slate: 'neutral', teal: 'success' }
const PREFIX = '(bg|text|border|ring|ring-offset|from|via|to|divide|fill|stroke|outline|placeholder|decoration|shadow|caret|accent)'

const known = new RegExp(`\\b${PREFIX}-(${Object.keys(FAMILY).join('|')})-(\\d{2,3})\\b`, 'g')
const review = new RegExp(`\\b${PREFIX}-(${Object.keys(REVIEW).join('|')})-(\\d{2,3})\\b`)
// Translucent white panels become opaque surface. Overlay alphas of 25 and
// below sit on coloured fills and are deliberately left alone.
const glass = /\bbg-white\/(30|40|50|55|60|70|80|90)\b/g
const blur = /\s?\bbackdrop-blur(?:-(?:none|sm|md|lg|xl|2xl|3xl))?\b/g

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (EXCLUDE.some((e) => relative(ROOT, full).startsWith(e))) continue
    const s = statSync(full)
    if (s.isDirectory()) walk(full, out)
    else if (/\.(tsx?|css)$/.test(name)) out.push(full)
  }
  return out
}

let changed = 0
let renamed = 0
const reviewList = []

for (const scope of SCOPES) {
  for (const file of walk(join(ROOT, scope))) {
    const src = readFileSync(file, 'utf8')
    let next = src.replace(known, (_m, prefix, fam, step) => {
      renamed += 1
      return `${prefix}-${FAMILY[fam]}-${step}`
    })
    next = next.replace(glass, 'bg-surface').replace(blur, '')
    src.split('\n').forEach((line, i) => {
      if (review.test(line)) reviewList.push(`${relative(ROOT, file)}:${i + 1}: ${line.trim()}`)
    })
    if (next !== src) {
      changed += 1
      if (!DRY) writeFileSync(file, next)
    }
  }
}

console.log(`${DRY ? '[dry] ' : ''}files changed: ${changed}, class renames: ${renamed}`)
console.log(`needs human review (${reviewList.length}):`)
for (const line of reviewList) console.log('  ' + line)
