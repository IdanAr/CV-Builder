import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer'
import { renderToGlyphRuns, findBaselineCollisions, fontDiagnostics } from './pdf-geometry'

vi.setConfig({ testTimeout: 20_000 })

// Mirrors what every template does today: the page declares a unitless
// lineHeight, which @react-pdf resolves against the *page* fontSize and then
// inherits to children as an absolute value.
function fixture(nameStyleExtras: Record<string, unknown>) {
  const styles = StyleSheet.create({
    page: { fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.15, padding: 40 },
    name: { fontSize: 22, fontWeight: 'bold', ...nameStyleExtras },
    label: { fontSize: 11, color: '#555555' },
  })
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.name }, 'Idan'),
      React.createElement(Text, { style: styles.label }, 'Solutions Architect | Data & AI')
    )
  )
}

describe('pdf-geometry', () => {
  it('detects the inherited-lineHeight collision', async () => {
    const runs = await renderToGlyphRuns(fixture({}))
    expect(findBaselineCollisions(runs)).not.toHaveLength(0)
  })

  it('reports no collision once lineHeight is re-declared alongside fontSize', async () => {
    const runs = await renderToGlyphRuns(fixture({ lineHeight: 1.15 }))
    expect(findBaselineCollisions(runs)).toHaveLength(0)
  })

  // Guards the detector against being loosened until it stops detecting.
  // lineHeight 1.0 on a 22pt run above an 11pt run genuinely overlaps by
  // 1.65pt — a detector that passes this fixture is too weak to be useful.
  it('still detects a marginal overlap at lineHeight 1.0', async () => {
    const runs = await renderToGlyphRuns(fixture({ lineHeight: 1.0 }))
    expect(findBaselineCollisions(runs)).not.toHaveLength(0)
  })

  // The Sidebar template is flexDirection:'row'. Runs in separate columns can
  // share a y-band without overlapping visually.
  it('ignores runs that share a baseline band but not horizontal space', () => {
    const rail  = { str: 'RAIL',  x: 40,  y: 700, width: 50, height: 12, fontName: 'f1', page: 1 }
    const main  = { str: 'MAIN',  x: 300, y: 695, width: 50, height: 12, fontName: 'f1', page: 1 }
    expect(findBaselineCollisions([rail, main])).toEqual([])
    // …but the same pair in one column does collide.
    expect(findBaselineCollisions([rail, { ...main, x: 45 }])).not.toHaveLength(0)
  })
})

describe('fontDiagnostics', () => {
  const wrap = (s: string) => Buffer.from(s, 'latin1')

  it('recognises every base-14 face, not just Times-Roman', () => {
    for (const name of ['Helvetica', 'Helvetica-Bold', 'Helvetica-Oblique',
                        'Times-Roman', 'Times-Bold', 'Times-Italic', 'Times-BoldItalic',
                        'Courier', 'Courier-BoldOblique', 'Symbol', 'ZapfDingbats']) {
      expect(fontDiagnostics(wrap(`/BaseFont /${name} /Type`)).usesBase14, name).toBe(true)
    }
  })

  it('does not mistake an embedded subset for a base-14 face', () => {
    expect(fontDiagnostics(wrap('/BaseFont /WEAIEY+Carlito-Regular /Type')).usesBase14).toBe(false)
    expect(fontDiagnostics(wrap('/BaseFont /TimesNewRomanPSMT /Type')).usesBase14).toBe(false)
  })

  it('accepts all three embedded font-program keys', () => {
    for (const key of ['/FontFile ', '/FontFile2 ', '/FontFile3 ']) {
      expect(fontDiagnostics(wrap(key)).embedded, key).toBe(true)
    }
    expect(fontDiagnostics(wrap('/FontMatrix ')).embedded).toBe(false)
  })
})
