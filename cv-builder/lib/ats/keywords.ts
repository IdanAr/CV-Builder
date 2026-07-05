const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'out', 'off', 'over', 'under', 'again', 'then', 'once', 'but', 'not',
  'than', 'too', 'very', 'that', 'this', 'these', 'those', 'such', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'any', 'all', 'also',
  'our', 'your', 'their', 'we', 'you', 'they', 'he', 'she', 'it',
  'who', 'which', 'what', 'how', 'when', 'where', 'why',
  'work', 'working', 'experience', 'role', 'position', 'job',
])

export function extractKeywords(text: string): string[] {
  if (!text.trim()) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/\.$/, ''))
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(
    `(?<![a-z0-9])${escapeRegExp(keyword.toLowerCase())}(?![a-z0-9])`,
    'i'
  )
  return pattern.test(text)
}

export function keywordOverlap(
  resumeText: string,
  jdKeywords: string[]
): { matched: string[]; missing: string[] } {
  const lower = resumeText.toLowerCase()
  const matched: string[] = []
  const missing: string[] = []
  for (const kw of jdKeywords) {
    if (matchesKeyword(lower, kw)) matched.push(kw)
    else missing.push(kw)
  }
  return { matched, missing }
}
