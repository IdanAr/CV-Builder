import { describe, it, expect } from 'vitest'
import { COLOR_THEMES, matchColorTheme } from '../color-themes'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05)

describe('color themes', () => {
  it('has unique ids and lowercase six-digit hex values', () => {
    expect(new Set(COLOR_THEMES.map((t) => t.id)).size).toBe(COLOR_THEMES.length)
    for (const t of COLOR_THEMES) {
      expect(t.primary, t.id).toMatch(/^#[0-9a-f]{6}$/)
      expect(t.accent, t.id).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('keeps every colour readable on white paper (4.5:1)', () => {
    for (const t of COLOR_THEMES) {
      expect(contrastOnWhite(t.primary), `${t.id} primary`).toBeGreaterThanOrEqual(4.5)
      expect(contrastOnWhite(t.accent), `${t.id} accent`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('matches by value, case-insensitively, and leaves anything else custom', () => {
    expect(matchColorTheme('#1E2A44', '#2457F5')?.id).toBe('midnight')
    expect(matchColorTheme('#1e2a44', '#000000')).toBeUndefined()
  })

  it('the schema default colours land on a theme, so a new CV shows one selected', () => {
    const { primaryColor, accentColor } = ResumeMetaSchema.parse({})
    expect(matchColorTheme(primaryColor, accentColor)?.id).toBe('classic')
  })
})
