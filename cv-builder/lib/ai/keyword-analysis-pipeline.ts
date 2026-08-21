// lib/ai/keyword-analysis-pipeline.ts
import { z } from 'zod'
import { getAnthropic } from './models'

const MAX_KEYWORDS = 30
const MAX_RESUME_TEXT_LENGTH = 10_000

const ConfirmedMatchesSchema = z.array(z.string())

/**
 * Given resume text and a list of JD keywords the regex-based matcher marked
 * as missing, asks Claude to judge which are already covered by a synonym,
 * abbreviation, or closely related term (e.g. "k8s" satisfies "kubernetes";
 * "led a team of 5 engineers" satisfies "leadership"). Returns the subset of
 * `missingKeywords` (original spelling) Claude confirms as covered.
 */
export async function runSemanticKeywordAnalysis(
  resumeText: string,
  missingKeywords: string[]
): Promise<string[]> {
  const keywords = missingKeywords.slice(0, MAX_KEYWORDS)
  if (keywords.length === 0 || !resumeText.trim()) return []

  const truncatedResumeText = resumeText.slice(0, MAX_RESUME_TEXT_LENGTH)

  const prompt = `You are an ATS keyword matcher reviewing a candidate's resume.

The keywords below come from a job description and were NOT found as exact text in the resume. For each keyword, check whether the resume text already demonstrates that skill through a clear synonym, abbreviation, or closely related term. Examples: "k8s" satisfies "kubernetes"; "led a team of 5 engineers" satisfies "leadership"; "Next.js" satisfies "react". Only confirm a match when the resume clearly demonstrates the underlying skill - a vague or unrelated connection does not count.

Keywords to check: ${keywords.join(', ')}

Resume text:
"""
${truncatedResumeText}
"""

Return ONLY a JSON array containing the subset of the keywords above that are already covered, using their exact original spelling from the list. Example: ["kubernetes", "leadership"]. If none are covered, return [].`

  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '[]'

  let raw: unknown
  try {
    raw = JSON.parse(responseText)
  } catch {
    // Claude frequently wraps array output in a ```json ... ``` fence or a
    // sentence of prose despite being told to return only the array — when
    // the whole response isn't valid JSON on its own, fall back to
    // extracting just the array substring instead of giving up entirely.
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('runSemanticKeywordAnalysis: no JSON array found in Claude response', responseText.slice(0, 500))
      return []
    }
    try {
      raw = JSON.parse(jsonMatch[0])
    } catch {
      console.error('runSemanticKeywordAnalysis: extracted array substring failed to parse', jsonMatch[0].slice(0, 500))
      return []
    }
  }

  const parsed = ConfirmedMatchesSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('runSemanticKeywordAnalysis: parsed JSON did not match expected shape', JSON.stringify(raw).slice(0, 500))
    return []
  }

  // Never trust Claude to only echo back what it was given - filter to the
  // exact input keywords (case-insensitive) so a hallucinated addition can't
  // leak into scoring.
  const keywordLookup = new Map(keywords.map(k => [k.toLowerCase(), k]))
  return parsed.data
    .filter(k => keywordLookup.has(k.toLowerCase()))
    .map(k => keywordLookup.get(k.toLowerCase())!)
}
