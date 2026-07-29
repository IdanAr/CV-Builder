import React from 'react'
import { richTextToHtml, splitParagraphs } from '@/lib/rich-text'
import { PARAGRAPH_GAP_PT, px } from '@/lib/design/tokens'

/**
 * Renders a rich-text field for the web preview, matching the PDF: a blank line
 * splits the text into paragraphs, each its own block so the break is visible.
 * Single-paragraph text renders as a plain inline <span>, exactly as before,
 * so the common case is untouched. Inline bold/italic/underline markers are
 * applied within each paragraph via richTextToHtml.
 */
export function RichText({ text }: { text?: string | null }): React.ReactNode {
  if (!text) return null
  const paragraphs = splitParagraphs(text)
  if (paragraphs.length === 0) return null
  if (paragraphs.length === 1) {
    return <span dangerouslySetInnerHTML={{ __html: richTextToHtml(paragraphs[0]) }} />
  }
  return (
    <>
      {paragraphs.map((paragraph, i) => (
        <span
          key={i}
          style={{ display: 'block', marginTop: i === 0 ? 0 : px(PARAGRAPH_GAP_PT) }}
          dangerouslySetInnerHTML={{ __html: richTextToHtml(paragraph) }}
        />
      ))}
    </>
  )
}
