import { describe, it, expect } from 'vitest'
import { letterFileTitle, letterHeader, letterRecipient, letterSubject } from '../header'

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

describe('letterSubject', () => {
  it('builds an English subject from role and company', () => {
    expect(letterSubject({ company: 'Acme', role: 'Data Analyst', language: 'en' })).toBe('Re: Data Analyst, Acme')
  })

  it('uses the Hebrew prefix', () => {
    expect(letterSubject({ company: 'Acme', role: 'Data Analyst', language: 'he' })).toBe('הנדון: Data Analyst, Acme')
  })

  it('drops a placeholder role', () => {
    expect(letterSubject({ company: 'Acme', role: 'Unspecified', language: 'en' })).toBe('Re: Acme')
  })

  it('drops a placeholder company', () => {
    expect(letterSubject({ company: 'Unspecified', role: 'Data Analyst', language: 'en' })).toBe('Re: Data Analyst')
  })

  it('is null when both are placeholders or empty', () => {
    expect(letterSubject({ company: 'Unspecified', role: 'Unspecified', language: 'en' })).toBeNull()
    expect(letterSubject({ company: ' ', role: '', language: 'he' })).toBeNull()
  })
})

describe('letterRecipient', () => {
  it('lists the hiring manager, then the company', () => {
    expect(letterRecipient({ company: 'Acme', hiringManager: 'Noa Cohen' })).toEqual(['Noa Cohen', 'Acme'])
  })

  it('trims values and drops empty ones', () => {
    expect(letterRecipient({ company: '  Acme  ', hiringManager: '   ' })).toEqual(['Acme'])
  })

  it('drops a placeholder company', () => {
    expect(letterRecipient({ company: 'Unspecified' })).toEqual([])
  })

  it('keeps the manager when the company is a placeholder', () => {
    expect(letterRecipient({ company: 'Unspecified', hiringManager: 'Noa Cohen' })).toEqual(['Noa Cohen'])
  })
})

describe('letterFileTitle', () => {
  it('builds the title from role and company', () => {
    expect(letterFileTitle({ company: 'Acme', role: 'Data Analyst' })).toBe('Cover Letter - Data Analyst - Acme')
  })

  it('removes characters unsafe in file names', () => {
    const t = letterFileTitle({ company: 'Acme/Labs\\Co', role: 'Data: Analyst*?"<>|' })
    expect(t).not.toMatch(/[/\\:*?"<>|]/)
    expect(t.startsWith('Cover Letter - ')).toBe(true)
  })

  it('removes control characters and collapses whitespace', () => {
    expect(letterFileTitle({ company: 'Acme\u0000\n  Labs', role: 'Analyst' })).toBe('Cover Letter - Analyst - Acme Labs')
  })

  it('keeps Hebrew letters', () => {
    expect(letterFileTitle({ company: 'אקמי', role: 'אנליסט' })).toBe('Cover Letter - אנליסט - אקמי')
  })

  it('drops placeholders', () => {
    expect(letterFileTitle({ company: 'Acme', role: 'Unspecified' })).toBe('Cover Letter - Acme')
    expect(letterFileTitle({ company: 'Unspecified', role: 'Unspecified' })).toBe('Cover Letter')
  })

  it('cuts to 120 characters without a trailing separator', () => {
    const t = letterFileTitle({ company: 'Acme', role: 'a'.repeat(200) })
    expect(t.length).toBeLessThanOrEqual(120)
    const cut = letterFileTitle({ company: 'b', role: `${'a'.repeat(100)} - x` })
    expect(cut).not.toMatch(/[\s-]$/)
  })
})
