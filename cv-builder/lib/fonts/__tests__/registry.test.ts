import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer'
import { registerPdfFonts, pdfFontFamily, FONT_SUBSTITUTES } from '../registry'
import { renderToBufferAndRuns, fontDiagnostics } from '@/lib/pdf/__tests__/pdf-geometry'

vi.setConfig({ testTimeout: 60_000 })

const SPECIALS = '₪1 million — em-dash, curly ’quote, €50, 20×3'

/**
 * @react-pdf splits a line into runs at arbitrary points — `₪` and `1` land in
 * separate runs, and the harness drops whitespace-only runs — so any assertion
 * on reassembled run text must be whitespace-insensitive. Comparing collapsed
 * forms tests the glyphs, which is what this suite is about.
 */
const collapse = (s: string) => s.replace(/\s+/g, '')

function doc(pickerName: string) {
  registerPdfFonts()
  const styles = StyleSheet.create({
    page: { fontFamily: pdfFontFamily(pickerName), fontSize: 12, padding: 40 },
  })
  return React.createElement(
    Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(Text, null, SPECIALS))
  )
}

describe('font registry', () => {
  it('covers every picker font', () => {
    for (const name of ['Calibri', 'Arial', 'Helvetica', 'Garamond', 'Cambria',
                        'Georgia', 'Lato', 'Roboto', 'IBM Plex Sans']) {
      expect(FONT_SUBSTITUTES[name], `missing substitute for ${name}`).toBeDefined()
    }
  })

  for (const pickerName of Object.keys(FONT_SUBSTITUTES)) {
    it(`${pickerName}: embeds the font and preserves special characters`, async () => {
      const { buffer, runs } = await renderToBufferAndRuns(doc(pickerName))
      const diag = fontDiagnostics(buffer)
      expect(diag.embedded).toBe(true)
      expect(diag.hasToUnicode).toBe(true)
      expect(diag.usesBase14).toBe(false)
      expect(collapse(runs.map(r => r.str).join(' '))).toContain(collapse('₪1 million'))
    })
  }
})

const HEBREW = 'שלום עולם'

function hebrewDoc(pickerName: string) {
  registerPdfFonts()
  const styles = StyleSheet.create({
    page: { fontFamily: pdfFontFamily(pickerName), fontSize: 12, padding: 40 },
  })
  return React.createElement(
    Document, null,
    React.createElement(Page, { size: 'A4', style: styles.page },
      React.createElement(Text, null, HEBREW))
  )
}

describe('Hebrew glyph fallback', () => {
  // Carlito (Calibri's substitute) has no `hebrew` @fontsource subset — this
  // exercises the ArimoHebrew fallback link, not a family that already covers
  // Hebrew on its own.
  for (const pickerName of ['Calibri', 'Arial']) {
    it(`${pickerName}: renders real Hebrew glyphs, not blank/missing characters`, async () => {
      const { buffer, runs } = await renderToBufferAndRuns(hebrewDoc(pickerName))
      const diag = fontDiagnostics(buffer)
      expect(diag.embedded).toBe(true)
      expect(diag.usesBase14).toBe(false)
      // Bidi reordering (via @react-pdf/textkit's bidi-js) legitimately flips
      // word order for RTL text — pdfjs reports runs in left-to-right x
      // position, which is the reverse of Hebrew reading order. Assert each
      // word's glyphs are present rather than the original logical order.
      const extracted = collapse(runs.map(r => r.str).join(' '))
      for (const word of HEBREW.split(' ')) {
        expect(extracted).toContain(word)
      }
    })
  }
})

describe('hyphenation', () => {
  it('never breaks a word across lines with an inserted hyphen', async () => {
    registerPdfFonts()
    const styles = StyleSheet.create({
      // Narrow column forces wrapping mid-phrase.
      page: { fontFamily: pdfFontFamily('Calibri'), fontSize: 12, padding: 40, width: 200 },
    })
    const element = React.createElement(
      Document, null,
      React.createElement(Page, { size: 'A4', style: styles.page },
        React.createElement(Text, null,
          'Led initiatives achieving sub-5-second response times on critical operational queries'))
    )
    const { runs } = await renderToBufferAndRuns(element)
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('sub-5-second')
    expect(text).not.toContain('sec-ond')
  })
})
