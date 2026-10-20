import { describe, expect, it } from 'vitest'
import { extractNumbers, sameNumber, type NumberMention } from '../numbers'

const first = (text: string): NumberMention => {
  const [n] = extractNumbers(text)
  if (!n) throw new Error(`no number in "${text}"`)
  return n
}

describe('extractNumbers', () => {
  it('expands money with suffixes, words and currencies', () => {
    expect(first('cut costs by $1.2M')).toMatchObject({ value: 1_200_000, kind: 'money', currency: 'USD' })
    expect(first('a 1,200,000 USD budget')).toMatchObject({ value: 1_200_000, kind: 'money', currency: 'USD' })
    expect(first('saved 1.2 million dollars')).toMatchObject({ value: 1_200_000, kind: 'money', currency: 'USD' })
    expect(first('grew to NIS 1.2M')).toMatchObject({ value: 1_200_000, kind: 'money', currency: 'ILS' })
    expect(first('grew to ₪1.2M')).toMatchObject({ value: 1_200_000, kind: 'money', currency: 'ILS' })
    expect(first('grew to 1.2M ₪')).toMatchObject({ value: 1_200_000, kind: 'money', currency: 'ILS' })
  })

  it('reads percentages written either way', () => {
    expect(first('up 40%')).toMatchObject({ kind: 'percent', value: 40 })
    expect(first('up 40 percent')).toMatchObject({ kind: 'percent', value: 40 })
  })

  it('reads multipliers', () => {
    expect(first('3x faster')).toMatchObject({ kind: 'multiplier', value: 3 })
  })

  it('treats +, over and more than as the same lower bound', () => {
    const a = first('over 5 years')
    const b = first('5+ years')
    const c = first('more than five years')
    for (const n of [a, b, c]) expect(n).toMatchObject({ kind: 'duration', lowerBound: true })
    expect(b.value).toBe(a.value)
    expect(c.value).toBe(a.value)
    expect(c.fromWord).toBe(true)
    expect(a.fromWord).toBe(false)
  })

  it('reads both ends of from-to pairs', () => {
    expect(extractNumbers('from 4.1s to 1.8s').map((n) => [n.kind, n.value])).toEqual([
      ['duration', 4.1],
      ['duration', 1.8],
    ])
    expect(extractNumbers('from 10 working days to 6').map((n) => n.value)).toEqual([10 * 86_400, 6])
    expect(extractNumbers('from 10 working days to 6')[1].kind).toBe('count')
  })

  it('reads year ranges with either dash as two years', () => {
    for (const text of ['2019–2022', '2019-2022']) {
      expect(extractNumbers(text).map((n) => [n.kind, n.value])).toEqual([
        ['year', 2019],
        ['year', 2022],
      ])
    }
  })

  it('applies a unit after a range to both ends', () => {
    const [a, b] = extractNumbers('3-5 years')
    expect(a).toMatchObject({ kind: 'duration' })
    expect(b).toMatchObject({ kind: 'duration' })
    expect(b.value / a.value).toBeCloseTo(5 / 3)
  })

  it('ignores quarter labels but keeps the year', () => {
    expect(extractNumbers('Q3 2024').map((n) => [n.kind, n.value])).toEqual([['year', 2024]])
  })

  it('reads number words and ordinals', () => {
    expect(extractNumbers('the third quarter')).toEqual([expect.objectContaining({ value: 3, fromWord: true, kind: 'count' })])
    expect(extractNumbers('one of the leads')).toEqual([expect.objectContaining({ value: 1, fromWord: true })])
  })

  it('reads Hebrew scale words and currency', () => {
    expect(first('30 מיליון משתמשים')).toMatchObject({ value: 30_000_000, kind: 'count' })
    expect(first('תקציב של 2 מיליון ש"ח')).toMatchObject({ value: 2_000_000, kind: 'money', currency: 'ILS' })
  })

  it('reads decades and marks approximate amounts', () => {
    const decades = first('nearly two decades of finance leadership')
    expect(decades).toMatchObject({ kind: 'duration', approximate: true })
    expect(decades.value).toBeCloseTo(first('20 years').value)
    expect(first('about 5 years')).toMatchObject({ approximate: true })
    expect(first('5 years')).toMatchObject({ approximate: false })
    expect(first('over a decade of marketing')).toMatchObject({ kind: 'duration', lowerBound: true, fromWord: true })
    expect(first('over a decade of marketing').value).toBeCloseTo(first('10 years').value)
    expect(first('more than a year in the role')).toMatchObject({ kind: 'duration', lowerBound: true })
    expect(extractNumbers('twice a year')).toEqual([])
  })

  it('records where each number sits in the text', () => {
    expect(first('cut costs by $1.2M').index).toBe('cut costs by '.length)
  })
})

describe('sameNumber', () => {
  const eq = (a: string, b: string) => sameNumber(first(a), first(b))

  it('matches equal values however they are written', () => {
    expect(eq('$1.2M', '1,200,000 USD')).toBe(true)
    expect(eq('1.2M', '$1.2M')).toBe(true)
    expect(eq('18 months', '1.5 years')).toBe(true)
    expect(eq('over 5 years', '5 years')).toBe(true)
    expect(eq('120%', '120%+')).toBe(true)
  })

  it('keeps different values, currencies and kinds apart', () => {
    expect(eq('$1.2M', '€1.2M')).toBe(false)
    expect(eq('40%', '40')).toBe(false)
    expect(eq('20%', '25%')).toBe(false)
  })
})
