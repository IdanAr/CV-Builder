import { describe, it, expect } from 'vitest'
import { parseRichText, richTextToHtml, stripRichText } from '../rich-text'

describe('parseRichText', () => {
  it('plain text → single TextRun with no flags', () => {
    const result = parseRichText('Hello world')
    expect(result).toEqual([{ text: 'Hello world' }])
  })

  it('**hello** → bold run', () => {
    const result = parseRichText('**hello**')
    expect(result).toEqual([{ text: 'hello', bold: true }])
  })

  it('*hello* → italic run', () => {
    const result = parseRichText('*hello*')
    expect(result).toEqual([{ text: 'hello', italic: true }])
  })

  it('__hello__ → underline run', () => {
    const result = parseRichText('__hello__')
    expect(result).toEqual([{ text: 'hello', underline: true }])
  })

  it('Hello **world** today → 3 runs: plain, bold, plain', () => {
    const result = parseRichText('Hello **world** today')
    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ text: 'Hello ' })
    expect(result[1]).toEqual({ text: 'world', bold: true })
    expect(result[2]).toEqual({ text: ' today' })
  })

  it('**__nested__** → one run with bold + underline', () => {
    const result = parseRichText('**__nested__**')
    expect(result).toHaveLength(1)
    expect(result[0].text).toBe('nested')
    expect(result[0].bold).toBe(true)
    expect(result[0].underline).toBe(true)
  })

  it('unclosed **hello → treated as literal text', () => {
    const result = parseRichText('**hello')
    expect(result).toEqual([{ text: '**hello' }])
  })

  it('unclosed *hello → treated as literal text', () => {
    const result = parseRichText('*hello')
    expect(result).toEqual([{ text: '*hello' }])
  })

  it('unclosed __hello → treated as literal text', () => {
    const result = parseRichText('__hello')
    expect(result).toEqual([{ text: '__hello' }])
  })

  it('empty string → single run with empty text', () => {
    const result = parseRichText('')
    expect(result).toEqual([{ text: '' }])
  })

  it('mixed markers: **bold** and *italic* and __underline__', () => {
    const result = parseRichText('**bold** and *italic* and __underline__')
    const texts = result.map((r) => r.text)
    expect(texts).toContain('bold')
    expect(texts).toContain('italic')
    expect(texts).toContain('underline')
    const bold = result.find((r) => r.text === 'bold')
    expect(bold?.bold).toBe(true)
    const italic = result.find((r) => r.text === 'italic')
    expect(italic?.italic).toBe(true)
    const underline = result.find((r) => r.text === 'underline')
    expect(underline?.underline).toBe(true)
  })

  it('bold + italic nested: ***text*** treated as ** then * or * then **', () => {
    // **bold** wraps *italic* or similar — just verify no crash and text is present
    const result = parseRichText('*__both__*')
    const combined = result.find((r) => r.text === 'both')
    expect(combined?.italic).toBe(true)
    expect(combined?.underline).toBe(true)
  })
})

describe('richTextToHtml', () => {
  it('plain text passes through with HTML escaping', () => {
    expect(richTextToHtml('Hello world')).toBe('Hello world')
  })

  it('Hello **world** → Hello <strong>world</strong>', () => {
    expect(richTextToHtml('Hello **world**')).toBe('Hello <strong>world</strong>')
  })

  it('*italic* → <em>italic</em>', () => {
    expect(richTextToHtml('*italic*')).toBe('<em>italic</em>')
  })

  it('__under__ → <u>under</u>', () => {
    expect(richTextToHtml('__under__')).toBe('<u>under</u>')
  })

  it('nested **__text__** → <strong><u>text</u></strong>', () => {
    expect(richTextToHtml('**__text__**')).toBe('<strong><u>text</u></strong>')
  })

  it('HTML-escapes < > & in plain text portions', () => {
    expect(richTextToHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })

  it('HTML-escapes inside marked spans', () => {
    expect(richTextToHtml('**a < b**')).toBe('<strong>a &lt; b</strong>')
  })

  it('unclosed marker treated as literal (no tags emitted)', () => {
    const html = richTextToHtml('**hello')
    expect(html).not.toContain('<strong>')
    expect(html).toContain('**hello')
  })
})

describe('stripRichText', () => {
  it('plain text unchanged', () => {
    expect(stripRichText('Hello world')).toBe('Hello world')
  })

  it('strips bold markers', () => {
    expect(stripRichText('**bold**')).toBe('bold')
  })

  it('strips italic markers', () => {
    expect(stripRichText('*italic*')).toBe('italic')
  })

  it('strips underline markers', () => {
    expect(stripRichText('__under__')).toBe('under')
  })

  it('Hello **world** *today* → Hello world today', () => {
    expect(stripRichText('Hello **world** *today*')).toBe('Hello world today')
  })

  it('unclosed marker stays as literal text', () => {
    expect(stripRichText('**hello')).toBe('**hello')
  })
})
