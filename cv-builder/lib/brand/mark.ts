/**
 * The brand mark, as data rather than as markup.
 *
 * `app/icon.svg` is the browser-tab favicon, but Next's file conventions mean
 * it is a static asset — it cannot be imported and re-rendered. The generated
 * image (`app/opengraph-image.tsx`) runs through satori, which needs the mark
 * inline as a data URI. So the same shapes would
 * otherwise be written out twice and drift apart silently.
 *
 * This module is the single source. `app/icon.svg` is the one copy that must be
 * kept in step by hand, and `__tests__/mark.test.ts` fails if it ever isn't.
 */

/** The browser's UI colour for the installed app (manifest `theme_color`). */
export const BRAND_VIOLET = '#7C3AED'
/** The CVitae Studio mark's plate colour: the kit's Blue. */
export const BRAND_BLUE = '#2F5BFF'

/**
 * The CVitae Studio mark: a rounded blue plate, a paper-white "C" and an ink
 * checkmark. Identical to the kit's `favicon.svg`, and therefore to
 * `app/icon.svg`.
 */
export const BRAND_MARK_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64.00 64.00" width="64" height="64" role="img" aria-label="CVitae Studio"><title>CVitae Studio</title><rect width="64" height="64" rx="14" fill="#2F5BFF"/><g transform="translate(6.00 6.00) scale(0.8125)"><path d="M45.5 15.9 A21 21 0 1 0 45.5 48.1" fill="none" stroke="#F7F7F4" stroke-width="9" stroke-linecap="round"/><path d="M24 33 L31.5 40.5 L52 18" fill="none" stroke="#10162A" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></g></svg>'

/**
 * Base64 rather than percent-encoded: satori parses `<img src>` data URIs
 * strictly, and an SVG carrying raw `#` and `"` characters is a common way to
 * get a silently blank image out of it.
 */
export const BRAND_MARK_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(BRAND_MARK_SVG).toString('base64')}`

/** The Open Graph card's backdrop — the indigo UI accent running into violet. */
export const brandGradient = 'linear-gradient(135deg, #312E81 0%, #4F46E5 55%, #6D28D9 100%)'
