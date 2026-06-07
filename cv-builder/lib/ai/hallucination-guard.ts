// lib/ai/hallucination-guard.ts

// Patterns representing verifiable numeric claims
const CLAIM_PATTERNS: RegExp[] = [
  /\d+%/g,           // percentages: 40%, 15%
  /\$\d+[kmb]?/gi,   // dollar amounts: $2M, $50k, $500
  /\b\d+[xX]\b/g,    // multipliers: 3x, 10X
  /\b\d{2,}\b/g,     // standalone numbers with 2+ digits: 500, 40
]

export function detectHallucinations(originalInput: string, generatedText: string): string[] {
  const lowerOriginal = originalInput.toLowerCase()
  const found = new Set<string>()

  for (const pattern of CLAIM_PATTERNS) {
    const matches = generatedText.match(pattern) ?? []
    for (const match of matches) {
      if (!lowerOriginal.includes(match.toLowerCase())) {
        found.add(match)
      }
    }
  }

  // Remove bare numbers that are substrings of a longer already-found match
  const all = Array.from(found)
  return all.filter(candidate => !all.some(other => other !== candidate && other.includes(candidate)))
}
