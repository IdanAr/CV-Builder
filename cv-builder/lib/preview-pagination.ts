export const A4_WIDTH_PX = 794
export const A4_HEIGHT_PX = 1123

export interface PageBreak {
  /** 1-based index of the page that ends at this break */
  page: number
  /** y-offset in unscaled template pixels where the break line sits */
  top: number
}

/**
 * Computes where PDF page breaks fall inside the continuous preview flow.
 *
 * The exported PDF applies `marginPx` as padding on every page, so each page
 * holds only (A4 height − 2×margin) of content. The preview renders one
 * continuous column with that padding applied once, so break k sits at
 * topMargin + k × usableHeight — not at flat multiples of the A4 height.
 */
export function computePageBreaks(templateHeightPx: number, marginPx: number): PageBreak[] {
  const usable = Math.max(1, A4_HEIGHT_PX - 2 * marginPx)
  const contentHeight = Math.max(0, templateHeightPx - 2 * marginPx)
  const pageCount = Math.max(1, Math.ceil(contentHeight / usable))
  return Array.from({ length: pageCount - 1 }, (_, i) => ({
    page: i + 1,
    top: marginPx + (i + 1) * usable,
  }))
}

/** Max characters of normalized page-start text sent as an anchor. */
export const ANCHOR_MAX_CHARS = 120

/**
 * Normalizes text so PDF-extracted strings and DOM textContent compare equal:
 * lowercase; strip soft hyphens, bullet glyphs, and hyphens (react-pdf
 * hyphenates words at line ends); collapse whitespace runs to single spaces.
 */
export function normalizeAnchorText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[­•·◦▪-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fully collapsed form used for substring matching: spaces removed too,
 * so the two engines' different word-wrapping cannot break a match.
 */
export function toMatchKey(s: string): string {
  return normalizeAnchorText(s).replace(/ /g, '')
}
