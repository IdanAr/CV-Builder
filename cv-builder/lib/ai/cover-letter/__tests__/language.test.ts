import { describe, expect, it } from 'vitest'
import { detectLanguage } from '../language'

describe('detectLanguage', () => {
  it('returns he for Hebrew text', () => {
    expect(detectLanguage('אנחנו מחפשים אנליסט נתונים שיעזור לנו להאיץ את הדיווח')).toBe('he')
  })

  it('returns en for English text', () => {
    expect(detectLanguage('We are looking for a data analyst who can speed up reporting.')).toBe('en')
  })

  it('returns en when Hebrew letters are under 30% of all letters', () => {
    expect(detectLanguage('We need a strong data analyst for our reporting team in Tel Aviv, משרה מלאה')).toBe('en')
  })

  it('returns he for a Hebrew posting with some English terms', () => {
    expect(detectLanguage('דרוש אנליסט עם ניסיון ב SQL ו Python לצוות הדיווח שלנו')).toBe('he')
  })

  it('returns en for an empty string and for text with no letters', () => {
    expect(detectLanguage('')).toBe('en')
    expect(detectLanguage('123 456 - ! ?')).toBe('en')
  })
})
