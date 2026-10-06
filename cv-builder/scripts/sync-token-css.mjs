// Rewrites the --color-* declarations in app/globals.css from
// lib/design/color-tokens.ts. CSS cannot import TypeScript, so this closes the
// loop the drift test only detects. Run via `npm run tokens:sync`.
// Imports a .ts file directly, so it needs Node >= 22.18 (native type
// stripping). CI does not run it; the drift test covers CI.
import { readFileSync, writeFileSync } from 'node:fs'
import { cssCustomProperties } from '../lib/design/color-tokens.ts'

const file = new URL('../app/globals.css', import.meta.url)
let css = readFileSync(file, 'utf8')
const tokens = cssCustomProperties()
const declared = new Set()
let updated = 0

css = css.replace(/^(\s*)(--color-[\w-]+)\s*:\s*[^;]+;/gm, (line, indent, name) => {
  const entry = tokens.find(([n]) => n === name)
  if (!entry) return line
  declared.add(name)
  updated += 1
  return `${indent}${name}: ${entry[1]};`
})

const missing = tokens.filter(([n]) => !declared.has(n))
if (missing.length) {
  const block = missing.map(([n, v]) => `  ${n}: ${v};`).join('\n')
  css = css.replace(/(--color-ring:[^;]+;)/, `$1\n${block}`)
}

css = css.replace(/--background:\s*#[0-9a-fA-F]{3,8};/, '--background: #f6f7f9;')
css = css.replace(/--foreground:\s*#[0-9a-fA-F]{3,8};/, '--foreground: #14161b;')

writeFileSync(file, css)
console.log(`updated ${updated} declarations, added ${missing.length}`)
