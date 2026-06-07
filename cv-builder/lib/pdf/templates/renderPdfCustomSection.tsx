import React from 'react'
import { View, Text, Link } from '@react-pdf/renderer'
import type { CustomSection } from '@/lib/schemas/resume.zod'
import { ensureHttps } from './pdf-utils'

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
        <View key={item.id || i} style={{ marginBottom: 8 }}>
          <View style={styles.entryRow}>
            {item.title ? <Text style={styles.bold}>{item.title}</Text> : null}
            {enabledFields.includes('dateRange') && (item.startDate || item.endDate) ? (
              <Text style={styles.small}>
                {[item.startDate, item.endDate].filter(Boolean).join(' – ')}
              </Text>
            ) : null}
          </View>
          {enabledFields.includes('subtitle') && item.subtitle ? (
            <Text style={styles.accent}>{item.subtitle}</Text>
          ) : null}
          {enabledFields.includes('url') && item.url ? (
            <Link src={ensureHttps(item.url)}>
              <Text style={styles.small}>{item.url}</Text>
            </Link>
          ) : null}
          {enabledFields.includes('summary') && item.summary ? (
            <Text style={styles.body}>{item.summary}</Text>
          ) : null}
          {enabledFields.includes('highlights') && (item.highlights ?? []).length > 0
            ? (item.highlights ?? []).map((h, hi) => (
                <Text key={hi} style={styles.bullet}>• {h}</Text>
              ))
            : null}
          {enabledFields.includes('keywords') && (item.keywords ?? []).length > 0 ? (
            <Text style={styles.small}>{(item.keywords ?? []).join(' · ')}</Text>
          ) : null}
          {enabledFields.includes('level') && item.level ? (
            <Text style={styles.small}>Level: {item.level}</Text>
          ) : null}
        </View>
      ))}
    </View>
  )
}
