/**
 * Device-level view preferences, stored in cookies (not localStorage) so the
 * server can render the right layout on the first paint with no flash and no
 * hydration mismatch. They are not account data.
 */

export const SIDEBAR_COOKIE = 'cvb-sidebar'
export const CVS_VIEW_COOKIE = 'cvb-cvs-view'

export type SidebarPref = 'expanded' | 'collapsed'
export type CvsView = 'table' | 'cards'

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export function parseSidebarPref(value: string | null | undefined): SidebarPref {
  return value === 'collapsed' ? 'collapsed' : 'expanded'
}

export function parseCvsView(value: string | null | undefined): CvsView {
  return value === 'cards' ? 'cards' : 'table'
}

export function serializePreferenceCookie(name: string, value: string): string {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax`
}

/** Client-side write. Silently does nothing where there is no `document`. */
export function writePreference(name: string, value: string): void {
  if (typeof document === 'undefined') return
  document.cookie = serializePreferenceCookie(name, value)
}
