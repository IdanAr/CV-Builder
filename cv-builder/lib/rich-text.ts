export interface TextRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}

/**
 * Escapes HTML special characters in a plain-text string.
 * Only escapes &, <, > — no other characters.
 */
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Parses a string with **bold**, *italic*, __underline__ markers
 * into an array of TextRun objects.
 * Markers may be nested (e.g. **__text__** = bold + underline).
 * Unmatched markers are treated as literal text.
 */
export function parseRichText(input: string): TextRun[] {
  // We tokenise left-to-right. We process __ before ** before * so that
  // double-char markers are never accidentally consumed as two single-char ones.
  type Token =
    | { type: 'text'; value: string }
    | { type: 'marker'; value: '__' | '**' | '*' }

  // Tokenise
  const tokens: Token[] = []
  let i = 0
  while (i < input.length) {
    if (input[i] === '_' && input[i + 1] === '_') {
      tokens.push({ type: 'marker', value: '__' })
      i += 2
    } else if (input[i] === '*' && input[i + 1] === '*') {
      tokens.push({ type: 'marker', value: '**' })
      i += 2
    } else if (input[i] === '*') {
      tokens.push({ type: 'marker', value: '*' })
      i += 1
    } else {
      // Accumulate plain text up to the next marker
      let j = i + 1
      while (
        j < input.length &&
        !(input[j] === '_' && input[j + 1] === '_') &&
        !(input[j] === '*' && input[j + 1] === '*') &&
        input[j] !== '*'
      ) {
        j++
      }
      tokens.push({ type: 'text', value: input.slice(i, j) })
      i = j
    }
  }

  // Parse tokens into runs using a simple recursive-descent / stack approach.
  // We track open markers on a stack; if a closing marker is found it pops
  // the stack and emits runs with the combined formatting of the stack depth
  // at that point. Unmatched opening markers are later flushed as literal text.
  type Frame = { marker: '__' | '**' | '*'; tokenIndex: number }

  const runs: TextRun[] = []
  // frameStack holds currently-open (unmatched) marker frames
  const frameStack: Frame[] = []
  // pendingText accumulates text/literal-markers between matched spans
  // We build the output by replaying tokens linearly and resolving matching.

  // Simpler two-pass strategy:
  // 1. Forward scan to pair each opening marker with its nearest same closing marker.
  // 2. Walk tokens in order, maintaining an "active flags" set.

  // Find matching pairs: for each marker token, search forward for the same marker.
  // We use a greedy earliest-match approach.
  const pairs = new Map<number, number>() // openIdx → closeIdx
  const usedAsClose = new Set<number>()

  for (let ti = 0; ti < tokens.length; ti++) {
    const tok = tokens[ti]
    if (tok.type !== 'marker') continue
    if (usedAsClose.has(ti)) continue
    // Already paired as an open? skip
    if ([...pairs.keys()].includes(ti)) continue

    // Search for a matching close
    for (let tj = ti + 1; tj < tokens.length; tj++) {
      if (usedAsClose.has(tj)) continue
      if ([...pairs.keys()].includes(tj)) continue
      const candidate = tokens[tj]
      if (candidate.type === 'marker' && candidate.value === tok.value) {
        // Check there's at least one text token in between (otherwise **  ** is odd
        // but the spec doesn't forbid it — allow it anyway)
        pairs.set(ti, tj)
        usedAsClose.add(tj)
        break
      }
    }
  }

  // Walk tokens and build runs
  const activeMarkers = new Set<'__' | '**' | '*'>()

  function currentFlags() {
    return {
      bold: activeMarkers.has('**'),
      italic: activeMarkers.has('*'),
      underline: activeMarkers.has('__'),
    }
  }

  function pushTextRun(text: string) {
    if (!text) return
    const { bold, italic, underline } = currentFlags()
    const run: TextRun = { text }
    if (bold) run.bold = true
    if (italic) run.italic = true
    if (underline) run.underline = true
    runs.push(run)
  }

  for (let ti = 0; ti < tokens.length; ti++) {
    const tok = tokens[ti]
    if (tok.type === 'text') {
      pushTextRun(tok.value)
    } else {
      // marker token
      if (pairs.has(ti)) {
        // This is a matched opening marker — toggle on
        activeMarkers.add(tok.value)
      } else if (usedAsClose.has(ti)) {
        // This is a matched closing marker — toggle off
        activeMarkers.delete(tok.value)
      } else {
        // Unmatched marker — emit as literal text
        pushTextRun(tok.value)
      }
    }
  }

  // Merge adjacent runs with identical formatting (cosmetic, not required)
  const merged: TextRun[] = []
  for (const run of runs) {
    const prev = merged[merged.length - 1]
    if (
      prev &&
      !!prev.bold === !!run.bold &&
      !!prev.italic === !!run.italic &&
      !!prev.underline === !!run.underline
    ) {
      prev.text += run.text
    } else {
      merged.push({ ...run })
    }
  }

  return merged.length > 0 ? merged : [{ text: input }]
}

/**
 * Converts a string with markers to an HTML string:
 * **text** → <strong>text</strong>
 * *text*  → <em>text</em>
 * __text__ → <u>text</u>
 * HTML-escapes &, <, > in plain text portions.
 * Safe to use with dangerouslySetInnerHTML.
 */
export function richTextToHtml(input: string): string {
  const runs = parseRichText(input)
  return runs
    .map((run) => {
      let html = escapeHtml(run.text)
      if (run.underline) html = `<u>${html}</u>`
      if (run.italic) html = `<em>${html}</em>`
      if (run.bold) html = `<strong>${html}</strong>`
      return html
    })
    .join('')
}

/**
 * Strips all markers from a string, returning plain text.
 * Used for ATS plain-text fallback and word count.
 */
export function stripRichText(input: string): string {
  return parseRichText(input)
    .map((r) => r.text)
    .join('')
}
