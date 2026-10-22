import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { letterLocale } from '@/lib/coverletter/header'
import { letterBlocks } from '@/lib/coverletter/body'
import type { CoverLetterRenderInput } from '@/lib/coverletter/render-input'
import { PARAGRAPH_GAP_PT } from '@/lib/design/tokens'
import { scalePt } from '@/lib/design/font-scale'
import { withFontScale } from '../font-scale'
import { mapToPdfFont, inToPt, renderPdfRichText } from './pdf-utils'

// The CV templates' default accent (ResumeMetaSchema), used when the colour is not a valid hex.
const DEFAULT_ACCENT = '#0066cc'
const HEX_COLOUR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

const accentOf = (value: string | undefined): string =>
  value !== undefined && HEX_COLOUR.test(value.trim()) ? value.trim() : DEFAULT_ACCENT

/**
 * Single-column PDF for a cover letter, in one of two designs: "classic"
 * (centred header over a thin accent rule) or "accent-edge" (left-aligned header
 * beside a thick accent bar). Reading order is the same in both: name, contact,
 * date, recipient, subject, then the body, so an ATS parser meets the sender's
 * details before the greeting. No résumé template is involved.
 */
export function CoverLetterPdfTemplate({
  content,
  design,
  language,
  name,
  contact,
  date,
  recipient,
  subject,
  title,
  font,
  headerFont,
  accentColor,
  fontScale = 1,
}: CoverLetterRenderInput) {
  const bodyFont = mapToPdfFont(font ?? 'Helvetica')
  // pdfFontFamily falls back to the default family for a name it does not know, so this never throws.
  const nameFont = headerFont ? mapToPdfFont(headerFont) : bodyFont
  const accent = accentOf(accentColor)
  const accentEdge = design === 'accent-edge'

  const styles = StyleSheet.create(
    withFontScale(
      {
        page: { fontFamily: bodyFont, fontSize: 11, lineHeight: 1.4, color: '#1a1a1a', padding: inToPt(1) },
        header: accentEdge
          ? { marginBottom: 18, paddingLeft: 10, borderLeftWidth: 4, borderLeftColor: accent, borderLeftStyle: 'solid' }
          : { marginBottom: 18, paddingBottom: 8, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: accent, borderBottomStyle: 'solid' },
        name: {
          fontFamily: nameFont,
          fontSize: 16,
          fontWeight: 'bold',
          marginBottom: 2,
          color: accentEdge ? accent : '#1a1a1a',
          textAlign: accentEdge ? 'left' : 'center',
        },
        contact: { fontSize: 10, textAlign: accentEdge ? 'left' : 'center' },
        date: { fontSize: 10, marginBottom: 12 },
        recipient: { fontSize: 11 },
        subject: { fontSize: 11, fontWeight: 'bold', marginTop: 12 },
        body: { fontSize: 11 },
        bulletMark: { width: 14 },
        bulletText: { flex: 1 },
      },
      fontScale,
    ),
  )

  const blocks = letterBlocks(content)
  const hasHeader = Boolean(name || contact)

  return (
    <Document title={title} author={name} subject="Cover Letter" language={letterLocale(language)}>
      <Page size="A4" style={styles.page}>
        {hasHeader ? (
          <View style={styles.header}>
            {name ? <Text style={styles.name}>{name}</Text> : null}
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
          </View>
        ) : null}
        {date ? <Text style={styles.date}>{date}</Text> : null}
        {recipient.map((line, i) => (
          <Text key={i} style={styles.recipient}>
            {line}
          </Text>
        ))}
        {subject ? <Text style={styles.subject}>{subject}</Text> : null}
        <View style={{ marginTop: subject || recipient.length > 0 ? scalePt(12, fontScale) : 0 }}>
          {blocks.map((block, i) =>
            block.kind === 'text' ? (
              <View key={i} style={i === 0 ? undefined : { marginTop: PARAGRAPH_GAP_PT }}>
                {renderPdfRichText(block.text, styles.body)}
              </View>
            ) : (
              <View key={i} style={i === 0 ? undefined : { marginTop: PARAGRAPH_GAP_PT }}>
                {block.items.map((item, j) => (
                  <View key={j} style={{ flexDirection: 'row', marginTop: j === 0 ? 0 : 2 }} wrap={false}>
                    <Text style={[styles.body, styles.bulletMark]}>•</Text>
                    <View style={styles.bulletText}>{renderPdfRichText(item, styles.body)}</View>
                  </View>
                ))}
              </View>
            ),
          )}
        </View>
      </Page>
    </Document>
  )
}
