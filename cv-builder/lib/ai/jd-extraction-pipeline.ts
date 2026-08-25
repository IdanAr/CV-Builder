// lib/ai/jd-extraction-pipeline.ts
import { z } from 'zod'
import { getAnthropic } from './models'

const MAX_JD_LENGTH = 10_000
const MAX_TERMS = 60

export type KeywordPriority = 'must' | 'nice-to-have' | 'ambiguous'

export interface ExtractedRequirement {
  term: string
  priority: KeywordPriority
}

const RequirementItemSchema = z.object({
  term: z.string(),
  priority: z.string().optional(),
})

/**
 * Normalizes Claude's priority phrasing to one of the three values this
 * pipeline promises. Claude won't always emit the exact enum string despite
 * the prompt asking for it (e.g. "Required" instead of "must") — matching on
 * substrings here is more forgiving than a strict enum check, and anything
 * unrecognized safely defaults to "ambiguous" rather than being dropped.
 */
export function normalizePriority(raw: unknown): KeywordPriority {
  if (typeof raw !== 'string') return 'ambiguous'
  const p = raw.toLowerCase()
  if (p.includes('must') || p.includes('required')) return 'must'
  if (p.includes('nice') || p.includes('advantage') || p.includes('preferred') || p.includes('plus') || p.includes('bonus')) return 'nice-to-have'
  return 'ambiguous'
}

/**
 * Extracts every specific, checkable ATS requirement from a job description —
 * hard skills, soft skills, tools/platforms, technologies, and methodologies —
 * regardless of whether the term is a single word (e.g. "Mixpanel") or a
 * multi-word phrase (e.g. "Google Cloud Platform"), each classified by how
 * strongly the JD requires it. Replaces the regex-based extractKeywords() as
 * the primary source when available; callers should fall back to
 * extractKeywords() when this returns an empty array.
 *
 * Terms are returned lowercased to match the existing all-lowercase keyword
 * convention used throughout lib/ats/keywords.ts and lib/ats/scorer.ts.
 */
export async function extractJdRequirements(jobDescription: string): Promise<ExtractedRequirement[]> {
  if (!jobDescription.trim()) return []

  const truncated = jobDescription.slice(0, MAX_JD_LENGTH)

  const prompt = `You are an expert technical recruiter analyzing a job description for ATS (Applicant Tracking System) keyword matching.

Extract every specific, checkable requirement a candidate's resume should be scored against: hard skills, soft skills, tools, platforms, software, technologies, methodologies, and certifications explicitly named in the text.

Rules:
- Use the natural, most common spelling and capitalization for each term (e.g. "Google Cloud Platform", "Mixpanel", "Agile", "Stakeholder Management", "React").
- Combine multi-word terms that name one specific thing into a single item (e.g. "Product Management", not "product" and "management" separately).
- Do not include generic filler, company boilerplate, or vague adjectives (e.g. "team player", "fast-paced environment", "passionate", "detail-oriented").
- Deduplicate. Return as many distinct terms as the job description actually specifies, up to ${MAX_TERMS}.

For each term, also classify how strongly the job description requires it:
- "must": explicitly required - marked "must", "must have", "required", or stated as a hard requirement with no qualifier.
- "nice-to-have": explicitly optional - marked "nice to have", "advantage", "preferred", "plus", "bonus", or similar.
- "ambiguous": the job description does not clearly state whether this is required or optional.

Return ONLY a JSON array of objects, no other text. Each object has this exact shape: {"term": "<term>", "priority": "must" | "nice-to-have" | "ambiguous"}.

Job description:
"""
${truncated}
"""

Example output: [{"term": "React", "priority": "must"}, {"term": "GraphQL", "priority": "nice-to-have"}, {"term": "Agile", "priority": "ambiguous"}]`

  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1500,
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

  if (!Array.isArray(raw)) {
    console.error('extractJdRequirements: parsed JSON was not an array', JSON.stringify(raw).slice(0, 500))
    return []
  }

  const seen = new Set<string>()
  const requirements: ExtractedRequirement[] = []
  for (const item of raw) {
    // Validate and normalize item-by-item rather than the whole array at
    // once — one malformed entry (wrong shape, missing term) should not
    // discard every other correctly-shaped entry in the same response.
    const parsed = RequirementItemSchema.safeParse(item)
    if (!parsed.success) continue
    const trimmed = parsed.data.term.trim().toLowerCase()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    requirements.push({ term: trimmed, priority: normalizePriority(parsed.data.priority) })
    if (requirements.length >= MAX_TERMS) break
  }
  return requirements
}
