import { describe, expect, it } from 'vitest'
import { buildFactSheet, renderFactSheet } from '../fact-sheet'
import type { DetectedGap } from '../gaps'
import { preparePosting } from '../posting'
import { buildCritiquePrompt, buildRefinePrompt, buildWritePrompt, situationAllowed } from '../prompt'
import type { WrittenLetter } from '../schema'
import { FIXTURE_CV } from './fixture-cv'

const GAP: DetectedGap = { from: '2022-01', to: '2022-12', months: 12, coveredBy: [], filled: [], after: '2021-12', exactStart: true }
const POSTING = { company: 'Globex', role: 'Data Analyst', jobText: 'Globex needs an analyst who can speed up reporting.' }

describe('situationAllowed', () => {
  it('is false for a straight CV with no notes', () => {
    expect(situationAllowed([], undefined)).toBe(false)
    expect(situationAllowed([], {})).toBe(false)
  })

  it('is true when the dates show a gap', () => {
    expect(situationAllowed([GAP], undefined)).toBe(true)
  })

  it('is true when the candidate wrote something to explain, and false for blank text', () => {
    expect(situationAllowed([], { explain: 'x' })).toBe(true)
    expect(situationAllowed([], { explain: '   ' })).toBe(false)
    expect(situationAllowed([], { motivation: 'I like their product' })).toBe(false)
  })
})

const write = (allowed: boolean) =>
  buildWritePrompt({
    factSheet: renderFactSheet(buildFactSheet(FIXTURE_CV)),
    posting: preparePosting(POSTING),
    role: POSTING.role,
    greeting: 'Dear Globex Hiring Team,',
    candidateName: 'Dana Levi',
    gaps: [GAP],
    situationAllowed: allowed,
    today: '2026-10',
  })

describe('buildWritePrompt: situation', () => {
  it('lists no gap and tells the model the situation is null when the code does not allow one', () => {
    const prompt = write(false)
    expect(prompt).not.toContain('2022-01 to 2022-12')
    expect(prompt).toMatch(/situation[^\n]*null/i)
    expect(prompt).toMatch(/must not discuss[^\n]*gaps?[^\n]*career change/i)
  })

  it('lists the gap when a situation is allowed', () => {
    expect(write(true)).toContain('2022-01 to 2022-12')
  })

  it('says the notes give the situation when there is no gap but the candidate explained something', () => {
    const prompt = buildWritePrompt({
      factSheet: renderFactSheet(buildFactSheet(FIXTURE_CV)),
      posting: preparePosting(POSTING),
      role: POSTING.role,
      greeting: 'Dear Globex Hiring Team,',
      candidateName: 'Dana Levi',
      notes: { explain: 'I moved cities' },
      gaps: [],
      situationAllowed: true,
      today: '2026-10',
    })
    expect(prompt).toContain('To explain: I moved cities')
    expect(prompt).toMatch(/notes give one/i)
  })

  it.each([true, false])('limits the situation to a sentence, bans history narration and sets the bullet rule (allowed: %s)', (allowed) => {
    const prompt = write(allowed)
    expect(prompt).not.toContain('one or two plain sentences')
    expect(prompt).not.toContain('rather than a list of bullets')
    expect(prompt).toMatch(/only narrates career history/i)
    expect(prompt).toMatch(/at most one list/i)
    expect(prompt).toContain('"bullet": true')
  })

  it('allows at most one sentence for the situation, never its own paragraph, when one is allowed', () => {
    expect(write(true)).toMatch(/at most one sentence[^\n]*never (?:its own paragraph|a paragraph of its own)/i)
  })
})

describe('buildRefinePrompt', () => {
  it('keeps the history, situation and list rules in force', () => {
    const previous = { plan: { needs: [], situation: null, openingAngle: '', whyCompany: { source: 'posting', text: '' }, sparse: false }, letter: { greeting: '', paragraphs: [], signOff: '' } } as WrittenLetter
    const prompt = buildRefinePrompt({ previous, issues: [{ kind: 'form', sentence: null, detail: 'x' }], factSheet: '', posting: preparePosting(POSTING) })
    expect(prompt).toMatch(/only narrates career history/i)
    expect(prompt).toMatch(/at most one list/i)
  })
})

describe('buildCritiquePrompt', () => {
  const letter = { plan: { needs: [], situation: null, openingAngle: '', whyCompany: { source: 'posting', text: '' }, sparse: false }, letter: { greeting: '', paragraphs: [], signOff: '' } } as WrittenLetter

  it('does not ask for a situation to be addressed unless one is allowed', () => {
    expect(buildCritiquePrompt(letter, 'facts', 'posting', false)).not.toContain('not addressed')
    expect(buildCritiquePrompt(letter, 'facts', 'posting', true)).toContain('not addressed')
  })

  it.each([true, false])('checks chronology, the situation sentence count and the list shape (allowed: %s)', (allowed) => {
    const prompt = buildCritiquePrompt(letter, 'facts', 'posting', allowed)
    expect(prompt).toContain('a sentence that only narrates career history')
    expect(prompt).toContain('the situation addressed in more than one sentence, or when it should not be')
    expect(prompt).toContain('a bullet that is a fragment or copies a fact line')
    expect(prompt).toContain('more than one list or a list outside 2 to 4 items')
  })
})
