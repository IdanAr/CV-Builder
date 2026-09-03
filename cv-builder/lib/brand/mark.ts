/**
 * The brand mark, as data rather than as markup.
 *
 * `app/icon.svg` is the browser-tab favicon, but Next's file conventions mean
 * it is a static asset — it cannot be imported and re-rendered. The generated
 * images (`app/opengraph-image.tsx`, `app/apple-icon.tsx`) run through satori,
 * which needs the mark inline as a data URI. So the same eleven shapes would
 * otherwise be written out three times and drift apart silently.
 *
 * This module is the single source. `app/icon.svg` is the one copy that must be
 * kept in step by hand, and `__tests__/mark.test.ts` fails if it ever isn't.
 */

/** The plate colour, also used as the PWA theme colour. */
export const BRAND_VIOLET = '#7C3AED'
/** The hexagon fill — violet-400, one step lighter than the plate. */
export const BRAND_VIOLET_LIGHT = '#A78BFA'

/**
 * The mark itself: a rounded violet plate, a lighter hexagon, a white spark.
 * Deliberately simpler than the navbar logo in `components/ui/AppNavbar.tsx`,
 * whose six r=4 satellite dots and six strokeWidth=2 connectors turn to noise
 * at favicon size. See the comment in `app/icon.svg` for the full reasoning.
 */
export const BRAND_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
  `<rect width="100" height="100" rx="22" fill="${BRAND_VIOLET}"/>` +
  `<polygon points="50,18 74,32 74,68 50,82 26,68 26,32" fill="${BRAND_VIOLET_LIGHT}"/>` +
  '<path d="M 38 44 L 47 44 L 50 38 L 53 44 L 62 44 L 56 53 L 59 62 L 50 56 L 41 62 L 44 53 Z" fill="#FFFFFF"/>' +
  '</svg>'

/**
 * Base64 rather than percent-encoded: satori parses `<img src>` data URIs
 * strictly, and an SVG carrying raw `#` and `"` characters is a common way to
 * get a silently blank image out of it.
 */
export const BRAND_MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(BRAND_MARK_SVG).toString('base64')}`

/** The Open Graph card's backdrop — the indigo UI accent running into the violet mark. */
export const brandGradient = 'linear-gradient(135deg, #312E81 0%, #4F46E5 55%, #6D28D9 100%)'
