import React from 'react'
import { Document, Page, StyleSheet, Text } from '@react-pdf/renderer'
import { mapToPdfFont, inToPt, renderPdfRichText } from './pdf-utils'

/** Plain single-column PDF for cover letter text only — no résumé template involved. */
export function CoverLetterPdfTemplate({
  content,
  name,
  font,
}: {
  content: string
  name?: string
  font?: string
}) {
  const bodyFont = mapToPdfFont(font ?? 'Helvetica')

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: 1.4, color: '#000000', padding: inToPt(1) },
    name: { fontSize: 14, fontWeight: 'bold', marginBottom: 14 },
    body: { fontSize: 11 },
  })

  return (
    <Document title={name ? `${name} - Cover Letter` : 'Cover Letter'} author={name} subject="Cover Letter" language="en">
      <Page size="A4" style={styles.page}>
        {name ? <Text style={styles.name}>{name}</Text> : null}
        {renderPdfRichText(content, styles.body)}
      </Page>
    </Document>
  )
}
