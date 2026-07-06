export interface DiffSegment {
  text: string
  changed: boolean
}

function tokenize(text: string): string[] {
  return text.match(/\S+|\s+/g) ?? []
}

function pushMerged(segments: DiffSegment[], text: string, changed: boolean): void {
  const last = segments[segments.length - 1]
  if (last && last.changed === changed) {
    last.text += text
  } else {
    segments.push({ text, changed })
  }
}

/**
 * Word-level diff between two strings, used to show only the words that
 * actually changed between a resume bullet's original and suggested text —
 * rather than marking the entire original as struck through.
 */
export function diffWords(original: string, suggested: string): { before: DiffSegment[]; after: DiffSegment[] } {
  const a = tokenize(original)
  const b = tokenize(suggested)
  const n = a.length
  const m = b.length

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const before: DiffSegment[] = []
  const after: DiffSegment[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      pushMerged(before, a[i], false)
      pushMerged(after, b[j], false)
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      pushMerged(before, a[i], true)
      i++
    } else {
      pushMerged(after, b[j], true)
      j++
    }
  }
  while (i < n) {
    pushMerged(before, a[i], true)
    i++
  }
  while (j < m) {
    pushMerged(after, b[j], true)
    j++
  }

  return { before, after }
}
