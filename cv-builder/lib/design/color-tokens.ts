/**
 * Single source of truth for every colour the interface uses.
 *
 * Before this file, 1,061 raw Tailwind colour utilities were spread across 58
 * component files: 675 indigo, 132 gray, 130 red, and so on, every one of them
 * a literal. That is why a single contrast defect needed 31 separate edits to
 * fix, and why dark mode was not expressible at all.
 *
 * Two tiers, deliberately:
 *
 *   PALETTE — what the colour *is*. `accent` is cobalt and `neutral` is a cool
 *   gray, both defined here; `danger`, `success` and `warning` remain the
 *   Tailwind 3.4 red, green and amber scales. Contrast is guaranteed by
 *   color-tokens.test.ts rather than by provenance.
 *
 *   SEMANTIC — what the colour *means*. `fg-body`, `input`,
 *   `surface-subtle`. Components should reach for these; the palette tier
 *   exists so the semantic tier has something to point at, and for the rare
 *   case that genuinely wants a specific step.
 *
 * Values are stored as space-separated RGB channels rather than hex so that
 * Tailwind's `<alpha-value>` placeholder works — that is what keeps
 * `bg-surface/70` (the app uses 13 different white alphas) expressible.
 *
 * Adding or changing a colour means editing this file and running
 * `npm run test:run` — `color-tokens.test.ts` fails if app/globals.css has
 * drifted out of sync, since CSS cannot import TypeScript.
 */

/** A colour as space-separated sRGB channels, e.g. `'67 56 202'`. */
export type Channels = string

export type PaletteScale = {
  50: Channels; 100: Channels; 200: Channels; 300: Channels; 400: Channels
  500: Channels; 600: Channels; 700: Channels; 800: Channels; 900: Channels
  950: Channels
}

/**
 * Tier 1. Family names are roles, not hues, so a rebrand is a change here
 * rather than a find-and-replace across 58 files. The source hue each family
 * was lifted from is noted for traceability.
 */
export const PALETTE = {
  /** cobalt, the product accent. 600 is #2457F5 (5.6:1 against white). */
  accent: {
    50: '238 243 255', 100: '224 233 255', 200: '197 214 255', 300: '154 183 255',
    400: '107 142 252', 500: '66 109 248', 600: '36 87 245', 700: '28 69 210',
    800: '27 58 166', 900: '25 48 128', 950: '17 30 82',
  },
  /** cool gray. 50 is the page canvas #F6F7F9, 900 is the text colour #14161B. */
  neutral: {
    50: '246 247 249', 100: '240 242 246', 200: '228 230 235', 300: '205 209 217',
    400: '128 135 148', 500: '110 117 130', 600: '91 98 112', 700: '66 72 85',
    800: '40 45 55', 900: '20 22 27', 950: '11 12 16',
  },
  /** from Tailwind `red` */
  danger: {
    50: '254 242 242', 100: '254 226 226', 200: '254 202 202', 300: '252 165 165',
    400: '248 113 113', 500: '239 68 68', 600: '220 38 38', 700: '185 28 28',
    800: '153 27 27', 900: '127 29 29', 950: '69 10 10',
  },
  /** from Tailwind `green` */
  success: {
    50: '240 253 244', 100: '220 252 231', 200: '187 247 208', 300: '134 239 172',
    400: '74 222 128', 500: '34 197 94', 600: '22 163 74', 700: '21 128 61',
    800: '22 101 52', 900: '20 83 45', 950: '5 46 22',
  },
  /** from Tailwind `amber` */
  warning: {
    50: '255 251 235', 100: '254 243 199', 200: '253 230 138', 300: '252 211 77',
    400: '251 191 36', 500: '245 158 11', 600: '217 119 6', 700: '180 83 9',
    800: '146 64 14', 900: '120 53 15', 950: '69 26 3',
  },
} as const satisfies Record<string, PaletteScale>

export type PaletteFamily = keyof typeof PALETTE

const WHITE: Channels = '255 255 255'

/**
 * Tier 2. Each entry records the contrast ratio it achieves against the
 * app background (#f5f3ff — the worst common case, since it is tinted and so
 * always slightly darker than white). WCAG 2.2 asks for 4.5:1 on body text,
 * 3:1 on large text and on the boundaries of controls you must be able to find.
 *
 * Ratios were computed from these exact channel values, not estimated.
 */
export const SEMANTIC = {
  // --- Surfaces ---
  surface: WHITE,
  /** Hover fills and quiet callouts. Neutral, never tinted. */
  'surface-subtle': PALETTE.neutral[100],
  /** Chip and badge fills that must read as separate from `surface-subtle`. */
  'surface-muted': PALETTE.neutral[200],
  /** The page itself, flat. */
  'surface-page': PALETTE.neutral[50],
  /** Selected rows, active tabs, the current nav item: the only cobalt wash. */
  'surface-selected': PALETTE.accent[50],
  /** Something is waiting on the user: counts, drafts to review, unverified claims. */
  'surface-attention': PALETTE.warning[100],

  // --- Foreground ---
  /** Default text. 16.9:1 on the page. */
  fg: PALETTE.neutral[900],
  /** Section and page headings. 16.9:1 */
  'fg-heading': PALETTE.neutral[900],
  /** Labels and secondary body copy. 8.6:1 */
  'fg-body': PALETTE.neutral[700],
  /** Captions, helper text, placeholders. 5.7:1 */
  'fg-muted': PALETTE.neutral[600],
  /** Same value as `fg-muted`; kept as its own name for existing call sites. 5.7:1 */
  'fg-subtle': PALETTE.neutral[600],
  /** On a cobalt fill (buttons). 5.6:1 */
  'fg-on-accent': WHITE,

  // --- Status foregrounds, all AA on the page background ---
  /** 6.0:1 */
  'fg-danger': PALETTE.danger[700],
  /** 4.7:1, little margin; do not lighten. */
  'fg-success': PALETTE.success[700],
  /** 4.7:1, little margin; do not lighten. */
  'fg-warning': PALETTE.warning[700],
  /** Amber text on `surface-attention`. 6.4:1 */
  'fg-attention': PALETTE.warning[800],

  // --- Status surfaces ---
  'surface-danger': PALETTE.danger[50],
  'surface-success': PALETTE.success[50],
  'surface-warning': PALETTE.warning[50],
  'border-danger': PALETTE.danger[200],
  'border-success': PALETTE.success[200],
  'border-warning': PALETTE.warning[200],
  'border-attention': PALETTE.warning[300],

  // --- Borders ---
  /** Hairlines and dividers. Decorative. */
  'border-subtle': PALETTE.neutral[100],
  /** Card and panel edges. Decorative. */
  border: PALETTE.neutral[200],
  /**
   * The visible edge of a control you must be able to locate. SC 1.4.11 asks
   * 3:1: neutral-400 is 3.4:1 on the page and 3.6:1 on white. Named `input`,
   * not `border-input`: Tailwind prefixes the key, so `border-input` would
   * generate `.border-border-input` and the real `.border-input` would not
   * exist. The "token utilities referenced in source" test guards this.
   */
  input: PALETTE.neutral[400],

  // --- Interactive ---
  primary: PALETTE.accent[600],
  'primary-hover': PALETTE.accent[700],
  'primary-fg': WHITE,
  /** Quiet fills: secondary buttons, progress tracks, skeleton bases. */
  secondary: PALETTE.accent[100],
  'secondary-fg': PALETTE.accent[700],
  /** Focus rings. 4.1:1 on the page. */
  ring: PALETTE.accent[500],
} as const

export type SemanticToken = keyof typeof SEMANTIC

/** CSS custom-property name for a palette entry, e.g. `--color-accent-700`. */
export function paletteVar(family: PaletteFamily, step: keyof PaletteScale): string {
  return `--color-${family}-${step}`
}

/** CSS custom-property name for a semantic token, e.g. `--color-fg-muted`. */
export function semanticVar(token: SemanticToken): string {
  return `--color-${token}`
}

/**
 * The full `:root` declaration list, in the order it appears in globals.css.
 * Exported so the test can assert the stylesheet has not drifted from this
 * file — CSS cannot import TypeScript, so the two are kept honest by test
 * rather than by build step.
 */
export function cssCustomProperties(): Array<[string, string]> {
  const out: Array<[string, string]> = []
  for (const family of Object.keys(PALETTE) as PaletteFamily[]) {
    for (const step of Object.keys(PALETTE[family]) as unknown as Array<keyof PaletteScale>) {
      out.push([paletteVar(family, step), PALETTE[family][step]])
    }
  }
  for (const token of Object.keys(SEMANTIC) as SemanticToken[]) {
    out.push([semanticVar(token), SEMANTIC[token]])
  }
  return out
}
