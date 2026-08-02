// lib/ai/jd-extraction-pipeline.ts
import { z } from 'zod'
import { getAnthropic } from './models'

const MAX_JD_LENGTH = 10_000
const MAX_TERMS = 60

const ExtractedTermsSchema = z.array(z.string())

/**
 * Extracts every specific, checkable ATS requirement from a job description —
 * hard skills, soft skills, tools/platforms, technologies, and methodologies —
 * regardless of whether the term is a single word (e.g. "Mixpanel") or a
 * multi-word phrase (e.g. "Google Cloud Platform"). Replaces the regex-based
 * extractKeywords() as the primary source when available; callers should
 * fall back to extractKeywords() when this returns an empty array.
 *
 * Terms are returned lowercased to match the existing all-lowercase keyword
 * convention used throughout lib/ats/keywords.ts and lib/ats/scorer.ts.
 */
export async function extractJdRequirements(jobDescription: string): Promise<string[]> {
  if (!jobDescription.trim()) return []

  const truncated = jobDescription.slice(0, MAX_JD_LENGTH)

  const prompt = `You are an expert technical recruiter analyzing a job description for ATS (Applicant Tracking System) keyword matching.

Extract every specific, checkable requirement a candidate's resume should be scored against: hard skills, soft skills, tools, platforms, software, technologies, methodologies, and certifications explicitly named in the text.

Rules:
- Use the natural, most common spelling and capitalization for each term (e.g. "Google Cloud Platform", "Mixpanel", "Agile", "Stakeholder Management", "React").
- Combine multi-word terms that name one specific thing into a single item (e.g. "Product Management", not "product" and "management" separately).
- Do not include generic filler, company boilerplate, or vague adjectives (e.g. "team player", "fast-paced environment", "passionate", "detail-oriented").
- Deduplicate. Return as many distinct terms as the job description actually specifies, up to ${MAX_TERMS}.

Job description:
"""
${truncated}
"""

Return ONLY a JSON array of strings, no other text. Example: ["React", "Google Cloud Platform", "Agile", "Stakeholder Management"]`

  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1000,
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
      console.error('extractJdRequirements: no JSON array found in Claude response', responseText.slice(0, 500))
      return []
    }
    try {
      raw = JSON.parse(jsonMatch[0])
    } catch {
      console.error('extractJdRequirements: extracted array substring failed to parse', jsonMatch[0].slice(0, 500))
      return []
    }
  }

  const parsed = ExtractedTermsSchema.safeParse(raw)
  if (!parsed.success) {
    console.error('extractJdRequirements: parsed JSON was not a string array', JSON.stringify(raw).slice(0, 500))
    return []
  }

  const seen = new Set<string>()
  const terms: string[] = []
  for (const term of parsed.data) {
    const trimmed = term.trim().toLowerCase()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    terms.push(trimmed)
    if (terms.length >= MAX_TERMS) break
  }
  return terms
}
