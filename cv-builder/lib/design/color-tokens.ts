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
 *   PALETTE — what the colour *is*. Copied verbatim from the Tailwind 3.4
 *   default palette (indigo/gray/red/green/amber) so that adopting a token is
 *   provably a no-op: `text-accent-700` renders the exact same pixels as the
 *   `text-indigo-700` it replaces. Migration cannot cause a visual regression.
 *
 *   SEMANTIC — what the colour *means*. `fg-body`, `border-input`,
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
  /** from Tailwind `indigo` — the product's brand hue */
  accent: {
    50: '238 242 255', 100: '224 231 255', 200: '199 210 254', 300: '165 180 252',
    400: '129 140 248', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202',
    800: '55 48 163', 900: '49 46 129', 950: '30 27 75',
  },
  /** from Tailwind `gray` */
  neutral: {
    50: '249 250 251', 100: '243 244 246', 200: '229 231 235', 300: '209 213 219',
    400: '156 163 175', 500: '107 114 128', 600: '75 85 99', 700: '55 65 81',
    800: '31 41 55', 900: '17 24 39', 950: '3 7 18',
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
  /** Cards, panels, popovers, inputs. */
  surface: WHITE,
  /** Tinted rows, hover fills, quiet callouts. */
  'surface-subtle': PALETTE.accent[50],
  /** Chip and badge fills that must read as separate from `surface-subtle`. */
  'surface-muted': PALETTE.accent[100],
  /** The page itself. Matches the legacy `--background`. */
  'surface-page': '245 243 255',

  // --- Foreground ---
  /** Default body copy. 14.6:1 — matches the legacy `--foreground`. */
  fg: PALETTE.accent[950],
  /** Section and page headings. 10.4:1 */
  'fg-heading': PALETTE.accent[900],
  /** Body copy and labels in the accent hue. 7.2:1 */
  'fg-body': PALETTE.accent[700],
  /**
   * De-emphasised copy — captions, helper text, placeholders. 5.7:1
   *
   * Deliberately accent-600 and not the accent-400 (2.7:1) or accent-300
   * (1.8:1) that 74 call sites currently use for this role. Those fail AA
   * outright; this is the accessible value the token points at, so repointing
   * a call site to `fg-muted` fixes its contrast as a side effect.
   */
  'fg-muted': PALETTE.accent[600],
  /** Neutral-hued de-emphasised copy, where accent tinting would be wrong. 6.9:1 */
  'fg-subtle': PALETTE.neutral[600],
  /** On an accent-600 fill (buttons). 6.3:1 */
  'fg-on-accent': WHITE,

  // --- Status foregrounds, all AA on the page background ---
  /** 5.9:1. danger-500, used by 41 call sites for error text, is 3.4:1 and fails. */
  'fg-danger': PALETTE.danger[700],
  /** 4.6:1 — clears AA, but with little margin; do not lighten. */
  'fg-success': PALETTE.success[700],
  /** 4.6:1 — clears AA, but with little margin; do not lighten. */
  'fg-warning': PALETTE.warning[700],

  // --- Status surfaces ---
  'surface-danger': PALETTE.danger[50],
  'surface-success': PALETTE.success[50],
  'surface-warning': PALETTE.warning[50],
  'border-danger': PALETTE.danger[200],
  'border-success': PALETTE.success[200],
  'border-warning': PALETTE.warning[200],

  // --- Borders ---
  /** Hairlines and dividers. Decorative, so no contrast floor applies. */
  'border-subtle': PALETTE.accent[100],
  /** Card and panel edges. Also decorative. */
  border: PALETTE.accent[200],
  /**
   * The visible edge of a control you must be able to locate — inputs,
   * selects, textareas. WCAG 2.2 SC 1.4.11 requires 3:1 here, so this is
   * accent-500 (4.1:1) and not the accent-200 (1.4:1) currently in use.
   */
  'border-input': PALETTE.accent[500],

  // --- Interactive ---
  /** Primary button and other filled accent affordances. */
  primary: PALETTE.accent[600],
  'primary-hover': PALETTE.accent[700],
  'primary-fg': WHITE,
  /** Quiet fills: secondary buttons, progress tracks, skeleton bases. */
  secondary: PALETTE.accent[100],
  'secondary-fg': PALETTE.accent[700],
  /** Focus rings. 4.1:1 against the page, comfortably over the 3:1 floor. */
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
