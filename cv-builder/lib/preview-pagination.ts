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
