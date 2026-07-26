import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { Document, Page, Text, StyleSheet } from '@react-pdf/renderer'
import { renderToGlyphRuns, findBaselineCollisions } from './pdf-geometry'

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
})
