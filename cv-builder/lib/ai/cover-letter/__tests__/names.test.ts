import { describe, expect, it } from 'vitest'
import { foldName, mentionsName, nameVariants, parentheticalAliases } from '../names'

describe('foldName', () => {
  it('folds case, punctuation and diacritics and drops legal suffixes', () => {
    expect(foldName('Rivière Ventures Ltd.')).toBe('riviere ventures')
    expect(foldName('Bright Path Software Technologies')).toBe('bright path')
  })

  it('keeps words that say what kind of institution it is', () => {
    expect(foldName('Tel Aviv University')).toBe('tel aviv university')
  })

  it('keeps non-Latin names instead of erasing them', () => {
    expect(foldName('גלבוע')).not.toBe('')
    expect(foldName(' גלבוע ')).toBe(foldName('גלבוע'))
  })
})

describe('parentheticalAliases', () => {
  it('splits an alias the CV gives in parentheses', () => {
    expect(parentheticalAliases('Israel Electric Corporation (IEC)')).toEqual({ base: 'Israel Electric Corporation', aliases: ['IEC'] })
  })
})

describe('nameVariants', () => {
  it('never returns an empty variant', () => {
    expect(nameVariants('')).toEqual([])
    expect(nameVariants('Ltd')).toEqual([])
  })
})

describe('mentionsName', () => {
  const v = (name: string) => nameVariants(name)

  it('accepts initials, leading tokens and folded spellings', () => {
    expect(mentionsName('At IEC I led the rollout', v('Israel Electric Corporation'))).toBe(true)
    expect(mentionsName('my time at Bright Path taught me', v('Bright Path Software'))).toBe(true)
    expect(mentionsName('as an engineer at NTX, I built', v('NTX Israel'))).toBe(true)
    expect(mentionsName('at Riviere ventures I sourced deals', v('Rivière Ventures'))).toBe(true)
    expect(mentionsName('בעבודתי ב גלבוע', v('גלבוע'))).toBe(true)
    expect(mentionsName('at Acme I ran the reporting', v('Acme Analytics Ltd'))).toBe(true)
    expect(mentionsName('at Riviere I sourced deals', v('Rivière Ventures'))).toBe(true)
  })

  it('rejects generic leading words, joined words and partial words', () => {
    expect(mentionsName('I moved to Israel in 2019', v('Israel Electric Corporation'))).toBe(false)
    expect(mentionsName('ran the brightpath review', v('Bright Path Software'))).toBe(false)
    expect(mentionsName('I had a bright idea every week', v('Bright Path Software'))).toBe(false)
    expect(mentionsName('the acme of the craft', v('Acme Analytics Ltd'))).toBe(false)
    expect(mentionsName('a Ntxa campaign', v('NTX Israel'))).toBe(false)
    expect(mentionsName('I moved to Tel Aviv', v('Tel Aviv University'))).toBe(false)
    expect(mentionsName('fluent in Hebrew', v('Hebrew University of Jerusalem'))).toBe(false)
  })

  it('never matches when there are no variants', () => {
    expect(mentionsName('anything at all', [])).toBe(false)
  })
})
