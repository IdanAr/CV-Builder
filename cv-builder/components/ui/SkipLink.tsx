/**
 * The "skip to content" link, first in the body and hidden until focused.
 *
 * WCAG 2.4.1 Bypass Blocks: every page renders the same navbar ahead of its
 * content — seven action items on the dashboard — so without this a keyboard
 * or screen-reader user walks the whole bar again on every navigation. Each
 * route provides the `#main-content` landmark it points at.
 *
 * Parked off-screen with a transform rather than the usual `sr-only
 * focus:not-sr-only` pairing. `not-sr-only` resets `padding` and
 * `white-space`, which fights this element's own `px-4 py-2` and collapsed it
 * to an 83x76 box with the label wrapped over three lines — visible, but not
 * readable. Staying absolutely positioned at all times keeps it out of the
 * layout while its box stays fixed, so what slides in on focus is the button
 * as designed: 169x36, comfortably past the 24x24 floor of SC 2.5.8.
 *
 * Lives in its own file rather than inline in the root layout so it can be
 * tested: the layout renders `<html>`/`<body>`, which jsdom will not mount.
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="absolute left-4 top-4 z-50 -translate-y-20 whitespace-nowrap rounded-control bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-lg transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 motion-reduce:transition-none"
    >
      Skip to main content
    </a>
  )
}
