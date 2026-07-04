// lib/preview-anchor.ts
// Locates PDF page-start anchor texts inside the HTML preview DOM and
// converts them to divider pixel positions. Text is the only coordinate
// system the PDF layout engine and the browser share — see
// docs/superpowers/plans/2026-07-04-true-pdf-preview-pagination.md.
import { toMatchKey } from '@/lib/preview-pagination'

export interface ResolvedBreak {
  /** 1-based index of the page that ends at this break. */
  page: number
  /** Visual (post-scale) pixels from the top of the preview wrapper. */
  top: number
  source: 'pdf' | 'estimate'
}

interface CharRef {
  node: Text
  offset: number
}

export interface TextIndex {
  /** Match-key string of the whole preview content. */
  key: string
  /** refs[i] = text node + offset of key[i]. */
  refs: CharRef[]
}

export type MeasureTop = (ref: CharRef, wrapper: HTMLElement) => number | null

export interface ResolveOptions {
  anchors: string[]
  /** Margin-aware fallback position (visual px) for break k. */
  estimateTopFor: (breakIndex: number) => number
  /** Wrapper height in visual px — breaks beyond this are dropped. */
  maxTop: number
  /** Minimum visual px between consecutive breaks (default 200). */
  minGap?: number
  /** Injectable for tests; default measures the matched line via Range. */
  measureTop?: MeasureTop
}

export function buildTextIndex(root: HTMLElement): TextIndex {
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let key = ''
  const refs: CharRef[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    const raw = node.data
    for (let i = 0; i < raw.length; i++) {
      const ch = toMatchKey(raw[i])
      if (!ch) continue
      key += ch
      refs.push({ node, offset: i })
    }
  }
  return { key, refs }
}

const MIN_MATCH = 20
const PREFIX_LENGTHS = [Infinity, 80, 40, MIN_MATCH]

export function findAnchorIndex(index: TextIndex, anchorKey: string, fromIndex: number): number {
  for (const len of PREFIX_LENGTHS) {
    const needle = anchorKey.slice(0, len)
    if (needle.length < MIN_MATCH) break
    const at = index.key.indexOf(needle, fromIndex)
    if (at !== -1) return at
  }
  // The anchor may start with the tail of a word hyphenated onto the new
  // PDF page; that remnant doesn't exist as a prefix in the DOM. Drop the
  // first 10 chars and retry with a mid-anchor slice.
  const inner = anchorKey.slice(10, 10 + 40)
  if (inner.length >= MIN_MATCH) {
    const at = index.key.indexOf(inner, fromIndex)
    if (at !== -1) return at
  }
  return -1
}

const defaultMeasureTop: MeasureTop = (ref, wrapper) => {
  const range = wrapper.ownerDocument.createRange()
  range.setStart(ref.node, ref.offset)
  range.setEnd(ref.node, Math.min(ref.offset + 1, ref.node.data.length))
  const rect = range.getClientRects()[0] ?? range.getBoundingClientRect()
  if (!rect || (rect.top === 0 && rect.height === 0)) return null
  return rect.top - wrapper.getBoundingClientRect().top
}

export function resolveAnchorTops(
  wrapper: HTMLElement,
  contentRoot: HTMLElement,
  opts: ResolveOptions
): ResolvedBreak[] {
  const { anchors, estimateTopFor, maxTop, minGap = 200, measureTop = defaultMeasureTop } = opts
  const index = buildTextIndex(contentRoot)
  const out: ResolvedBreak[] = []
  let searchFrom = 0
  let prevTop = 0

  anchors.forEach((anchor, k) => {
    const anchorKey = anchor.replace(/ /g, '')
    let top: number | null = null
    let source: ResolvedBreak['source'] = 'estimate'

    if (anchorKey.length >= MIN_MATCH) {
      const at = findAnchorIndex(index, anchorKey, searchFrom)
      if (at !== -1) {
        const measured = measureTop(index.refs[at], wrapper)
        if (measured !== null && measured > prevTop + minGap && measured < maxTop) {
          top = measured
          source = 'pdf'
          searchFrom = at + 1
        }
      }
    }

    if (top === null) {
      const estimated = estimateTopFor(k)
      if (estimated <= prevTop + minGap || estimated >= maxTop) return
      top = estimated
    }

    out.push({ page: k + 1, top, source })
    prevTop = top
  })

  return out
}
