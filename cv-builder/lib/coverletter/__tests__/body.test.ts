import { describe, it, expect } from 'vitest'
import { letterBlocks } from '../body'

describe('letterBlocks', () => {
  it('turns plain paragraphs into text blocks', () => {
    expect(letterBlocks('First paragraph.\n\nSecond paragraph.')).toEqual([
      { kind: 'text', text: 'First paragraph.' },
      { kind: 'text', text: 'Second paragraph.' },
    ])
  })

  it('turns a lead-in line followed by a list into text then list', () => {
    expect(letterBlocks('Lead in.\n- a\n- b')).toEqual([
      { kind: 'text', text: 'Lead in.' },
      { kind: 'list', items: ['a', 'b'] },
    ])
  })

  it('keeps a single "- " line as text', () => {
    expect(letterBlocks('- only one')).toEqual([{ kind: 'text', text: '- only one' }])
  })

  it('turns three list lines followed by a blank line and prose into list then text', () => {
    expect(letterBlocks('- one\n- two\n- three\n\nClosing prose.')).toEqual([
      { kind: 'list', items: ['one', 'two', 'three'] },
      { kind: 'text', text: 'Closing prose.' },
    ])
  })

  it('keeps soft line breaks inside a text block joined with newline', () => {
    expect(letterBlocks('Line one.\nLine two.')).toEqual([
      { kind: 'text', text: 'Line one.\nLine two.' },
    ])
  })

  it('keeps rich-text markers in text and list items', () => {
    expect(letterBlocks('**Bold** intro.\n- *styled* item\n- __under__ item')).toEqual([
      { kind: 'text', text: '**Bold** intro.' },
      { kind: 'list', items: ['*styled* item', '__under__ item'] },
    ])
  })

  it('handles CRLF input', () => {
    expect(letterBlocks('Intro.\r\n\r\n- a\r\n- b\r\n\r\nOutro.')).toEqual([
      { kind: 'text', text: 'Intro.' },
      { kind: 'list', items: ['a', 'b'] },
      { kind: 'text', text: 'Outro.' },
    ])
  })

  it('trims list items and drops the marker', () => {
    expect(letterBlocks('-   spaced item  \n- second ')).toEqual([
      { kind: 'list', items: ['spaced item', 'second'] },
    ])
  })

  it('returns no blocks for empty or whitespace-only input', () => {
    expect(letterBlocks('')).toEqual([])
    expect(letterBlocks('  \n\n  ')).toEqual([])
  })
})
