import { splitParagraphs } from '@/lib/rich-text'

export type LetterBlock = { kind: 'text'; text: string } | { kind: 'list'; items: string[] }

const isListLine = (line: string): boolean => line.startsWith('- ')

/**
 * Splits a letter's plain-text body into text and list blocks.
 *
 * Paragraphs come from `splitParagraphs`, so blank lines separate blocks and
 * CRLF is normalised. Inside a paragraph, a run of two or more consecutive
 * "- " lines becomes one list block (the marker is dropped and each item is
 * trimmed). Every other line stays text. Consecutive text lines are joined
 * with "\n", so the soft line breaks and rich-text markers survive as typed.
 * A lone "- " line is not a list and stays text.
 *
 * Pure and client-safe: no server imports.
 */
export function letterBlocks(content: string): LetterBlock[] {
  const blocks: LetterBlock[] = []

  for (const lines of splitParagraphs(content)) {
    let pending: string[] = []
    const flush = () => {
      if (pending.length > 0) {
        blocks.push({ kind: 'text', text: pending.join('\n') })
        pending = []
      }
    }

    let i = 0
    while (i < lines.length) {
      if (!isListLine(lines[i])) {
        pending.push(lines[i])
        i++
        continue
      }
      let end = i
      while (end < lines.length && isListLine(lines[end])) end++
      if (end - i >= 2) {
        flush()
        blocks.push({
          kind: 'list',
          items: lines.slice(i, end).map((line) => line.slice(2).trim()),
        })
      } else {
        pending.push(lines[i])
      }
      i = end
    }
    flush()
  }

  return blocks
}
