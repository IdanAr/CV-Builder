import React from 'react'
import { View, Text, Link } from '@react-pdf/renderer'
import type { CustomSection } from '@/lib/schemas/resume.zod'
import { ensureHttps, renderPdfRichText, renderPdfRichTextRuns } from './pdf-utils'
import { formatDate } from '@/lib/format-date'

interface PdfCustomSectionStyles {
  sectionTitle: object
  entryRow: object
  bold: object
  accent: object
  small: object
  body: object
  bullet: object
}

export function renderPdfCustomSection(
  section: CustomSection,
  styles: PdfCustomSectionStyles
): React.ReactNode {
  const { name, enabledFields, items } = section
  if (!items.length) return null

  return (
    <View key={section.id}>
      <Text style={styles.sectionTitle}>{name}</Text>
      {items.map((item, i) => (
        <View key={item.id || i} style={{ marginBottom: 7.5 }}>
          <View style={styles.entryRow}>
            {item.title ? <Text style={styles.bold}>{item.title}</Text> : null}
            {enabledFields.includes('dateRange') && (item.startDate || item.endDate) ? (
              <Text style={styles.small}>
                {[formatDate(item.startDate), formatDate(item.endDate)].filter(Boolean).join(' – ')}
              </Text>
            ) : null}
          </View>
          {enabledFields.includes('subtitle') && item.subtitle ? (
            <Text style={styles.accent}>{item.subtitle}</Text>
          ) : null}
          {enabledFields.includes('url') && item.url ? (
            <Link src={ensureHttps(item.url)}>
              <Text style={{ fontSize: 9, color: '#0066cc' }}>{item.url}</Text>
            </Link>
          ) : null}
          {enabledFields.includes('summary') && item.summary
            ? renderPdfRichText(item.summary, styles.body)
            : null}
          {enabledFields.includes('highlights') && (item.highlights ?? []).length > 0
            ? (item.highlights ?? []).map((h, hi) => (
                <Text key={hi} style={hi === 0 ? [styles.bullet, { marginTop: 3 }] : styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
              ))
            : null}
          {enabledFields.includes('keywords') && (item.keywords ?? []).length > 0 ? (
            <Text style={{ fontSize: 9, color: '#555555', marginTop: 2 }}>{(item.keywords ?? []).join(' · ')}</Text>
          ) : null}
          {enabledFields.includes('level') && item.level ? (
            <Text style={{ fontSize: 9, color: '#555555' }}>Level: {item.level}</Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}
