import { describe, it, expect } from 'vitest'
import React from 'react'
import { Document, Page } from '@react-pdf/renderer'
import type { CustomSection } from '@/lib/schemas/resume.zod'
import { renderPdfCustomSection } from '../templates/renderPdfCustomSection'
import { renderToGlyphRuns } from './pdf-geometry'

const styles = {
  sectionTitle: {}, bold: {}, accent: {}, small: {}, body: {}, bullet: {},
}

const section: CustomSection = {
  id: 'cs1', name: 'Military Service', enabledFields: ['dateRange', 'roles'],
  items: [{
    id: 'i1', title: 'IDF - Intelligence Corps', startDate: '2016-03', endDate: '2018-03',
    roles: [{ id: 'r1', title: 'Team Commander', startDate: '2018-03', endDate: '2019-03', summary: 'Led a 6-person team.' }],
  }],
}

describe('renderPdfCustomSection nested roles', () => {
  it('renders each role beneath the item', async () => {
    const doc = (
      <Document>
        <Page size="A4">{renderPdfCustomSection(section, styles)}</Page>
      </Document>
    )
    const runs = await renderToGlyphRuns(doc)
    const text = runs.map(r => r.str).join(' ')
    expect(text).toContain('Team Commander')
    expect(text).toContain('Led a 6-person team.')
  })
})
