import { describe, expect, it } from 'vitest'
import { parseLabels, renderSheet, roundRobin, scoreAgreement, sentenceForClaim, type CalibrationItem } from './calibration'

const item = (id: string, judgeFlagged: boolean): CalibrationItem => ({
  id, letterId: 'p01.s1', company: 'Acme', sentence: `Sentence ${id}`, resumeLines: [], judgeFlagged,
})

describe('calibration sheet', () => {
  it('reads labels from confirmation sheets (K ids) as well as calibration sheets (C ids)', () => {
    expect([...parseLabels('## K01 (letter, acme)\n\nLabel:ok\n\n## K02 (letter, acme)\n\nLabel: error\n')]).toEqual([['K01', 'ok'], ['K02', 'error']])
  })

  it('round-trips labels through the rendered sheet and never shows the verdict', () => {
    const sheet = renderSheet([item('C01', true), item('C02', false)])
    expect(sheet).not.toMatch(/flagged/i)
    const [head, ...rest] = sheet.split(/^Label:\s*$/m)
    const filled = head + ['error', ' OK'].map((label, i) => `Label: ${label}${rest[i]}`).join('')
    expect([...parseLabels(filled)]).toEqual([['C01', 'error'], ['C02', 'ok']])
  })

  it('scores agreement and separates false alarms from misses, skipping unsure', () => {
    const items = [item('C01', true), item('C02', true), item('C03', false), item('C04', false)]
    const labels = new Map([['C01', 'error'], ['C02', 'ok'], ['C03', 'error'], ['C04', 'unsure']] as const)
    const a = scoreAgreement(items, labels)
    expect(a.labelled).toBe(3)
    expect(a.agree).toBe(1)
    expect(a.falseAlarms.map((i) => i.id)).toEqual(['C02'])
    expect(a.misses.map((i) => i.id)).toEqual(['C03'])
  })

  it('finds the sentence a claim refers to, or none when too little overlaps', () => {
    const sentences = ['I completed the GenAI program at Northfield Institute last year.', 'At NTX I reduced false positives by 20% in production.']
    expect(sentenceForClaim('reduced false positives by 20%', sentences)).toBe(sentences[1])
    expect(sentenceForClaim('deep Kubernetes expertise', sentences)).toBeNull()
  })

  it('takes items in turn from each group', () => {
    expect(roundRobin([[1, 2, 3], [4], [5, 6]], 5)).toEqual([1, 4, 5, 2, 6])
  })
})
