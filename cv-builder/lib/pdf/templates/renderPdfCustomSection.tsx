import React from 'react'
import { View, Text, Link } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { CustomSection } from '@/lib/schemas/resume.zod'
import { ensureHttps, renderPdfRichText, renderPdfRichTextRuns } from './pdf-utils'
import { formatDateRange } from '@/lib/format-date'
import { resolveCustomSectionRoles } from '@/lib/roles'

interface PdfCustomSectionStyles {
  sectionTitle: Style
  entryRow?: Style
  bold: Style
  accent: Style
  small: Style
  body: Style
  bullet: Style
  link?: Style
  keywords?: Style
  level?: Style
}

export function renderPdfCustomSection(
  section: CustomSection,
  styles: PdfCustomSectionStyles
): React.ReactNode {
  const { name, enabledFields, items } = section
  if (!items.length) return null
  const hasRoles = enabledFields.includes('roles')

  return (
    <View key={section.id}>
      <Text style={styles.sectionTitle}>{name}</Text>
      {items.map((item, i) => {
        const roles = hasRoles ? resolveCustomSectionRoles(item) : []
        const headerDates = !hasRoles && enabledFields.includes('dateRange')
          ? formatDateRange(item.startDate, item.endDate)
          : ''
        return (
          <View key={item.id || i} style={{ marginBottom: 7.5 }}>
            {(item.title || headerDates) ? (
              <Text style={{ marginBottom: 2 }}>
                {item.title ? <Text style={styles.bold}>{item.title}</Text> : null}
                {headerDates ? <Text style={styles.small}>{'  ·  '}{headerDates}</Text> : null}
              </Text>
            ) : null}
            {!hasRoles && enabledFields.includes('subtitle') && item.subtitle ? (
              <Text style={styles.accent}>{item.subtitle}</Text>
            ) : null}
            {enabledFields.includes('url') && item.url ? (
              <Link src={ensureHttps(item.url)}>
                <Text style={styles.link ?? { fontSize: 9, color: '#0066cc' }}>{item.url}</Text>
              </Link>
            ) : null}
            {!hasRoles && enabledFields.includes('summary') && item.summary
              ? renderPdfRichText(item.summary, styles.body)
              : null}
            {!hasRoles && enabledFields.includes('highlights') && (item.highlights ?? []).length > 0
              ? (item.highlights ?? []).map((h, hi) => (
                  <Text key={hi} style={hi === 0 ? [styles.bullet, { marginTop: 3 }] : styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                ))
              : null}
            {!hasRoles && enabledFields.includes('keywords') && (item.keywords ?? []).length > 0 ? (
              <Text style={styles.keywords ?? { fontSize: 9, color: '#555555', marginTop: 2 }}>{(item.keywords ?? []).join(' · ')}</Text>
            ) : null}
            {!hasRoles && enabledFields.includes('level') && item.level ? (
              <Text style={styles.level ?? { fontSize: 9, color: '#555555' }}>Level: {item.level}</Text>
            ) : null}
            {hasRoles && roles.length > 0 ? (
              <View style={{ marginTop: 3 }}>
                {roles.map((role, ri) => (
                  <View key={role.id || ri} style={{ marginTop: ri === 0 ? 0 : 5 }}>
                    {(role.title || role.startDate || role.endDate) ? (
                      <Text style={{ marginBottom: 1 }}>
                        {role.title ? <Text style={styles.accent}>{role.title}</Text> : null}
                        {(role.startDate || role.endDate) ? (
                          <Text style={styles.small}>{'  ·  '}{formatDateRange(role.startDate, role.endDate)}</Text>
                        ) : null}
                      </Text>
                    ) : null}
                    {enabledFields.includes('subtitle') && role.subtitle ? <Text style={styles.accent}>{role.subtitle}</Text> : null}
                    {enabledFields.includes('summary') && role.summary ? renderPdfRichText(role.summary, styles.body) : null}
                    {enabledFields.includes('highlights') && (role.highlights ?? []).map((h, hi) => (
                      <Text key={hi} style={hi === 0 ? [styles.bullet, { marginTop: 2 }] : styles.bullet}>{'• '}{renderPdfRichTextRuns(h)}</Text>
                    ))}
                    {enabledFields.includes('keywords') && (role.keywords ?? []).length > 0 ? (
                      <Text style={styles.keywords ?? { fontSize: 9, color: '#555555', marginTop: 2 }}>{(role.keywords ?? []).join(' · ')}</Text>
                    ) : null}
                    {enabledFields.includes('level') && role.level ? (
                      <Text style={styles.level ?? { fontSize: 9, color: '#555555' }}>Level: {role.level}</Text>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}
