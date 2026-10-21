import { describe, it, expect } from 'vitest'
import { letterHeader } from '../header'

const DATE = new Date('2026-10-21')

describe('letterHeader', () => {
  it('joins email, phone and city with a middle dot and formats the English date', () => {
    expect(
      letterHeader(
        { name: 'Dana Levi', email: 'd@example.com', phone: '050-0000000', location: { city: 'Haifa' } },
        DATE,
        'en',
      ),
    ).toEqual({ name: 'Dana Levi', contact: 'd@example.com · 050-0000000 · Haifa', date: '21 October 2026' })
  })

  it('appends the first profile URL last', () => {
    const h = letterHeader(
      {
        name: 'Dana Levi',
        email: 'd@example.com',
        profiles: [
          { id: 'a', network: 'LinkedIn', url: 'linkedin.com/in/dana-example' },
          { id: 'b', network: 'GitHub', url: 'github.com/dana-example' },
        ],
      },
      DATE,
      'en',
    )
    expect(h.contact).toBe('d@example.com · linkedin.com/in/dana-example')
  })

  it('skips missing, empty and whitespace-only fields without stray separators', () => {
    expect(letterHeader({ name: 'Dana Levi', phone: '050-0000000' }, DATE, 'en').contact).toBe('050-0000000')
    expect(
      letterHeader(
        { name: 'Dana Levi', email: '  ', phone: '', location: { city: ' Haifa ' }, profiles: [{ id: 'a', url: '' }] },
        DATE,
        'en',
      ).contact,
    ).toBe('Haifa')
  })

  it('uses the first profile that has a URL', () => {
    const h = letterHeader(
      { profiles: [{ id: 'a', network: 'X' }, { id: 'b', url: 'github.com/dana-example' }] },
      DATE,
      'en',
    )
    expect(h.contact).toBe('github.com/dana-example')
  })

  it('returns an empty contact and name when basics is missing', () => {
    expect(letterHeader(undefined, DATE, 'en')).toEqual({ name: '', contact: '', date: '21 October 2026' })
  })

  it('formats the date in Hebrew for a he letter', () => {
    expect(letterHeader({ name: 'דנה לוי' }, DATE, 'he').date).toBe('21 באוקטובר 2026')
  })

  it('is not shifted by the server time zone near midnight UTC', () => {
    expect(letterHeader({}, new Date('2026-10-21T23:30:00Z'), 'en').date).toBe('21 October 2026')
    expect(letterHeader({}, new Date('2026-10-21T00:30:00Z'), 'en').date).toBe('21 October 2026')
  })
})
