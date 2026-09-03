/** Shared premium field styling for all editor forms. DRY source of truth —
 *  do not redeclare per-form input class strings. Compose with `cn()` when a
 *  field needs extras (`cn(inputClass, 'h-40 resize-none')`), so conflicting
 *  utilities are resolved rather than left to fight in the stylesheet.
 *
 *  Two values here are deliberately not what they were, because this single
 *  string reaches most of the app's form controls and both failed WCAG:
 *
 *  - The placeholder was `text-indigo-300`, 1.8:1 against the page. Most of
 *    these forms label their fields with `sr-only` text, which makes the
 *    placeholder the only label a sighted user gets — so it was the only
 *    visible identifier of the field, and it was effectively invisible. It is
 *    now `fg-muted` (5.7:1), still clearly lighter than entered text, which
 *    inherits `fg` at 14.6:1.
 *
 *  - The border was `indigo-200`, 1.4:1, leaving the field with no findable
 *    edge. SC 1.4.11 asks 3:1 of a control's boundary; `border-input` is
 *    4.1:1.
 *
 *  Both are token references, so the values live in lib/design/color-tokens.ts
 *  and are covered by its contrast test rather than being re-litigated here.
 */
export const inputClass =
  'w-full border border-input rounded-control px-3 py-1.5 text-sm bg-surface/70 shadow-sm transition-all duration-200 hover:border-primary focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary focus:shadow-md placeholder:text-fg-muted'

/** `fg-muted` is the same accent-600 this was already using, now named. */
export const labelClass = 'block text-xs font-medium text-fg-muted mb-1'
