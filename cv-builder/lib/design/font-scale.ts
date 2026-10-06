/**
 * `meta.fontScale` is a multiplier over each template's own base sizes, not an
 * absolute size, because the templates start from different bases (Classic
 * 11pt, ATS 10.5pt, ...). Every renderer funnels through these helpers so the
 * preview, the PDF and the DOCX cannot drift on rounding.
 */
export const FONT_SCALE_MIN = 0.9
export const FONT_SCALE_MAX = 1.1

/** Stored documents predate the field, so a missing value means "unchanged". */
export function resolveFontScale(meta: { fontScale?: number | null }): number {
  const k = meta.fontScale
  if (typeof k !== 'number' || !Number.isFinite(k)) return 1
  return Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, k))
}

export function scalePt(pt: number, scale: number): number {
  return Math.round(pt * scale * 100) / 100
}

export function pts(pt: number, scale: number): string {
  return `${scalePt(pt, scale)}pt`
}
