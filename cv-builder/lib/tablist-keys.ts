import type { KeyboardEvent } from 'react'

/**
 * Arrow-key navigation for a `role="tablist"`, per the WAI-ARIA Tabs pattern.
 *
 * Four tablists in this app declared the roles and `aria-selected` correctly
 * but handled no keys, which is the half that matters: a screen-reader user is
 * told "tab, 2 of 4" and then finds the arrow keys do nothing. The pattern is
 * identical in all four, so it lives here once rather than four times —
 * `StepsBar` and `ProfileWizardSteps` are already near-duplicates of each
 * other and had drifted apart in every other respect.
 *
 * Attach the returned handler to the tablist container, not to each tab. The
 * handler finds the tabs by role at event time, so a tablist whose tabs are
 * conditional (the editor renders four, the mobile switcher two) needs no
 * extra wiring, and nothing has to be kept in sync with the render.
 *
 * Activation is automatic — moving to a tab selects it — which the pattern
 * permits when switching panels is cheap, and all of these just toggle local
 * state. Selection reuses each tab's own `onClick` via `.click()`, so callers
 * keep their existing logic and this file never needs to know what a tab does.
 */

/** Disabled tabs are skipped rather than focused-but-inert. */
function enabledTabs(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
    (tab) =>
      tab.getAttribute('aria-disabled') !== 'true' && !(tab as HTMLButtonElement).disabled
  )
}

export function handleTablistKeyDown(event: KeyboardEvent<HTMLElement>): void {
  const { key } = event
  if (key !== 'ArrowRight' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') {
    return
  }

  const tabs = enabledTabs(event.currentTarget)
  if (tabs.length === 0) return

  const current = tabs.indexOf(document.activeElement as HTMLElement)

  let next: number
  if (key === 'Home') next = 0
  else if (key === 'End') next = tabs.length - 1
  // A key pressed while focus sits on the container rather than on a tab still
  // has a sensible answer: enter from whichever end the arrow points from.
  else if (current === -1) next = key === 'ArrowRight' ? 0 : tabs.length - 1
  // Wrapping is what the pattern specifies, and it is what makes a four-tab
  // bar navigable without counting.
  else if (key === 'ArrowRight') next = (current + 1) % tabs.length
  else next = (current - 1 + tabs.length) % tabs.length

  event.preventDefault()
  tabs[next].focus()
  tabs[next].click()
}

/**
 * Roving tabindex: the tablist is a single Tab stop and the arrows move within
 * it. Without this, Tab walks through every tab, so reaching the panel you
 * just opened means passing all of the ones you did not choose.
 */
export function tabIndexFor(isSelected: boolean): 0 | -1 {
  return isSelected ? 0 : -1
}
