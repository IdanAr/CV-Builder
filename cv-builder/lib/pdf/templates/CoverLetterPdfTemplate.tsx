import React from 'react'
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import { letterLocale, type LetterLanguage } from '@/lib/coverletter/header'
import { mapToPdfFont, inToPt, renderPdfRichText } from './pdf-utils'

/**
 * Plain single-column PDF for cover letter text only — no résumé template involved.
 * Reading order is the header (name, contact line, date) and then the body, so an
 * ATS parser meets the sender's details before the greeting.
 */
export function CoverLetterPdfTemplate({
  content,
  name,
  contact,
  date,
  language = 'en',
  font,
}: {
  content: string
  name?: string
  /** One line: email · phone · city · profile URL. Omitted when empty. */
  contact?: string
  date?: string
  language?: LetterLanguage
  font?: string
}) {
  const bodyFont = mapToPdfFont(font ?? 'Helvetica')

  const styles = StyleSheet.create({
    page: { fontFamily: bodyFont, fontSize: 11, lineHeight: 1.4, color: '#000000', padding: inToPt(1) },
    header: { marginBottom: 14 },
    name: { fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    contact: { fontSize: 10, marginBottom: 2 },
    date: { fontSize: 10 },
    body: { fontSize: 11 },
  })

  const hasHeader = Boolean(name || contact || date)

  return (
    <Document
      title={name ? `${name} - Cover Letter` : 'Cover Letter'}
      author={name}
      subject="Cover Letter"
      language={letterLocale(language)}
    >
      <Page size="A4" style={styles.page}>
        {hasHeader ? (
          <View style={styles.header}>
            {name ? <Text style={styles.name}>{name}</Text> : null}
            {contact ? <Text style={styles.contact}>{contact}</Text> : null}
            {date ? <Text style={styles.date}>{date}</Text> : null}
          </View>
        ) : null}
        {renderPdfRichText(content, styles.body)}
      </Page>
    </Document>
  )
}
