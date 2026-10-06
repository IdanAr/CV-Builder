// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import {
  SIDEBAR_COOKIE,
  CVS_VIEW_COOKIE,
  parseSidebarPref,
  parseCvsView,
  serializePreferenceCookie,
  writePreference,
} from '../preferences'

describe('preferences', () => {
  beforeEach(() => {
    document.cookie = `${SIDEBAR_COOKIE}=; Max-Age=0; Path=/`
    document.cookie = `${CVS_VIEW_COOKIE}=; Max-Age=0; Path=/`
  })

  it('names the cookies as the spec says', () => {
    expect(SIDEBAR_COOKIE).toBe('cvb-sidebar')
    expect(CVS_VIEW_COOKIE).toBe('cvb-cvs-view')
  })

  it('parses the sidebar preference, defaulting to expanded', () => {
    expect(parseSidebarPref('collapsed')).toBe('collapsed')
    expect(parseSidebarPref('expanded')).toBe('expanded')
    expect(parseSidebarPref('nonsense')).toBe('expanded')
    expect(parseSidebarPref(undefined)).toBe('expanded')
    expect(parseSidebarPref(null)).toBe('expanded')
  })

  it('parses the CVs view, defaulting to table', () => {
    expect(parseCvsView('cards')).toBe('cards')
    expect(parseCvsView('table')).toBe('table')
    expect(parseCvsView('grid')).toBe('table')
    expect(parseCvsView(undefined)).toBe('table')
  })

  it('serializes a one-year, site-wide, lax cookie', () => {
    expect(serializePreferenceCookie('cvb-sidebar', 'collapsed')).toBe(
      'cvb-sidebar=collapsed; Max-Age=31536000; Path=/; SameSite=Lax'
    )
  })

  it('writes the cookie to document.cookie', () => {
    writePreference(CVS_VIEW_COOKIE, 'cards')
    expect(document.cookie).toContain('cvb-cvs-view=cards')
  })
})
