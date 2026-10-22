import { describe, expect, it } from 'vitest'
import { renderLetter, stripBulletMarker, type LetterSentence } from '../letter'

const prose = (text: string): LetterSentence => ({ text, facts: [], quotes: [], bullet: false })
const bullet = (text: string): LetterSentence => ({ text, facts: [], quotes: [], bullet: true })
const letter = (...paragraphs: LetterSentence[][]) => ({ greeting: 'Hello,', paragraphs, signOff: 'Best,\nDana' })

describe('renderLetter', () => {
  it('joins prose sentences with a space and paragraphs with a blank line', () => {
    expect(renderLetter(letter([prose('One.'), prose('Two.')], [prose('Three.')]))).toBe('Hello,\n\nOne. Two.\n\nThree.\n\nBest,\nDana')
  })

  it('renders a lead-in and its bullets as one block of "- " lines', () => {
    const text = renderLetter(letter([prose('prose text'), bullet('one'), bullet('two'), bullet('three')]))
    expect(text).toContain('\n\nprose text\n- one\n- two\n- three\n\n')
  })

  it('keeps prose that follows the list on its own line', () => {
    const text = renderLetter(letter([bullet('one'), bullet('two'), prose('After.')]))
    expect(text).toContain('\n\n- one\n- two\nAfter.\n\n')
  })

  it('does not double a dash the model typed into a bullet', () => {
    expect(renderLetter(letter([bullet('- one'), bullet('two')]))).toContain('- one\n- two')
  })

  it('separates two paragraphs with a blank line even when one is a list', () => {
    const text = renderLetter(letter([prose('Intro.')], [bullet('one'), bullet('two')]))
    expect(text).toContain('Intro.\n\n- one\n- two')
  })
})

describe('stripBulletMarker', () => {
  it('removes one leading dash, bullet glyph or star with its space, and nothing else', () => {
    expect(stripBulletMarker('- one two')).toBe('one two')
    expect(stripBulletMarker('  • one two')).toBe('one two')
    expect(stripBulletMarker('* one two')).toBe('one two')
    expect(stripBulletMarker('-5 degrees')).toBe('-5 degrees')
  })
})
