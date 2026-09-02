import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import colors from 'tailwindcss/colors'
import {
  PALETTE,
  SEMANTIC,
  cssCustomProperties,
  paletteVar,
  semanticVar,
  type Channels,
  type PaletteFamily,
  type PaletteScale,
  type SemanticToken,
} from '../color-tokens'

const GLOBALS_CSS = join(__dirname, '..', '..', '..', 'app', 'globals.css')

/** Relative luminance per WCAG 2.x, from space-separated sRGB channels. */
function luminance(channels: Channels): number {
  const [r, g, b] = channels.split(' ').map(Number)
  const toLinear = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrast(a: Channels, b: Channels): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Parse `--name: value;` pairs out of the stylesheet's `:root` block. */
function rootCustomProperties(): Map<string, string> {
  const css = readFileSync(GLOBALS_CSS, 'utf8')
  const block = /:root\s*\{([\s\S]*?)\n\}/.exec(css)
  if (!block) throw new Error('no :root block found in app/globals.css')
  const found = new Map<string, string>()
  for (const [, name, value] of block[1].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    found.set(name, value.trim())
  }
  return found
}

describe('colour palette', () => {
  // The migration story only holds if adopting a token is provably a no-op:
  // `text-accent-700` must render the identical pixels to the
  // `text-indigo-700` it replaces. A typo in one channel would break that
  // silently, so the values are checked against Tailwind's own palette.
  const sources: Record<PaletteFamily, Record<string, string>> = {
    accent: colors.indigo,
    neutral: colors.gray,
    danger: colors.red,
    success: colors.green,
    warning: colors.amber,
  }

  it.each(Object.keys(PALETTE) as PaletteFamily[])(
    '%s matches its Tailwind source hue exactly',
    (family) => {
      for (const step of Object.keys(PALETTE[family]) as unknown as Array<keyof PaletteScale>) {
        const hex = sources[family][String(step)]
        const expected = [1, 3, 5]
          .map((i) => parseInt(hex.slice(i, i + 2), 16))
          .join(' ')
        expect(`${family}-${step}: ${PALETTE[family][step]}`).toBe(`${family}-${step}: ${expected}`)
      }
    }
  )

  it('gives every family the full 11-step scale', () => {
    for (const family of Object.keys(PALETTE) as PaletteFamily[]) {
      expect(Object.keys(PALETTE[family])).toEqual([
        '50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950',
      ])
    }
  })
})

describe('semantic tokens', () => {
  // Guards the reason the token layer exists. Someone lightening `fg-muted`
  // back toward accent-400 for looks would silently reintroduce the defect
  // that affected 74 call sites; this fails the build instead.
  const PAGE = SEMANTIC['surface-page']

  const bodyText: SemanticToken[] = [
    'fg', 'fg-heading', 'fg-body', 'fg-muted', 'fg-subtle',
    'fg-danger', 'fg-success', 'fg-warning',
  ]

  it.each(bodyText)('%s clears WCAG AA (4.5:1) on the page background', (name) => {
    expect(contrast(SEMANTIC[name], PAGE)).toBeGreaterThanOrEqual(4.5)
  })

  it('keeps primary-button text readable on its own fill', () => {
    expect(contrast(SEMANTIC['primary-fg'], SEMANTIC.primary)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(SEMANTIC['secondary-fg'], SEMANTIC.secondary)).toBeGreaterThanOrEqual(4.5)
  })

  it.each(['border-input', 'ring'] as SemanticToken[])(
    '%s clears the 3:1 floor SC 1.4.11 sets for control boundaries',
    (name) => {
      expect(contrast(SEMANTIC[name], PAGE)).toBeGreaterThanOrEqual(3)
      expect(contrast(SEMANTIC[name], SEMANTIC.surface)).toBeGreaterThanOrEqual(3)
    }
  )

  it('resolves every semantic token to a real colour', () => {
    for (const [name, value] of Object.entries(SEMANTIC)) {
      expect(`${name}: ${value}`).toMatch(/^[\w-]+: \d{1,3} \d{1,3} \d{1,3}$/)
    }
  })
})

describe('app/globals.css', () => {
  // CSS cannot import TypeScript, so nothing but this test stops the
  // stylesheet from drifting away from the source of truth.
  it('declares every token, with the value the TypeScript source gives it', () => {
    const declared = rootCustomProperties()
    const drifted = cssCustomProperties()
      .filter(([name, value]) => declared.get(name) !== value)
      .map(([name, value]) => `${name}: expected ${value}, stylesheet has ${declared.get(name) ?? '(missing)'}`)

    expect(drifted).toEqual([])
  })

  it('declares no token the TypeScript source does not know about', () => {
    const known = new Set(cssCustomProperties().map(([name]) => name))
    const orphans = [...rootCustomProperties().keys()].filter(
      // --background/--foreground predate the token layer and are consumed
      // directly by `body`; they are intentionally not token-managed.
      (name) => name.startsWith('--color-') && !known.has(name)
    )
    expect(orphans).toEqual([])
  })

  it('exposes the tokens components actually reach for', () => {
    const declared = rootCustomProperties()
    for (const name of ['primary', 'surface', 'fg-muted', 'border-input', 'ring'] as SemanticToken[]) {
      expect(declared.has(semanticVar(name))).toBe(true)
    }
    expect(declared.has(paletteVar('accent', 600))).toBe(true)
  })
})
