import React from 'react'
import { richTextToHtml, splitParagraphs } from '@/lib/rich-text'
import { PARAGRAPH_GAP_PT, px } from '@/lib/design/tokens'

/**
 * Renders a rich-text field for the web preview, matching the PDF: a blank line
 * splits the text into paragraphs, each its own block so the break is visible.
 * A single newline within a paragraph renders as a <br/> soft break. Single-
 * paragraph, single-line text renders as a plain inline <span>, exactly as
 * before, so the common case is untouched. Inline bold/italic/underline
 * markers are applied within each line via richTextToHtml.
 */
export function RichText({ text }: { text?: string | null }): React.ReactNode {
  if (!text) return null
  const paragraphs = splitParagraphs(text)
  if (paragraphs.length === 0) return null

  function renderLines(lines: string[]): React.ReactNode {
    return lines.map((line, i) => (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        <span dangerouslySetInnerHTML={{ __html: richTextToHtml(line) }} />
      </React.Fragment>
    ))
  }

  if (paragraphs.length === 1) {
    return <>{renderLines(paragraphs[0])}</>
  }
  return (
    <>
      {paragraphs.map((lines, i) => (
        <span
          key={i}
          style={{ display: 'block', marginTop: i === 0 ? 0 : px(PARAGRAPH_GAP_PT) }}
        >
          {renderLines(lines)}
        </span>
      ))}
    </>
  )
}
