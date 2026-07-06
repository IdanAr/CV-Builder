import { z } from 'zod'
import { getAnthropic } from './models'
import { detectHallucinations } from './hallucination-guard'
import { flattenAllText } from '@/lib/ats/scorer'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export interface AtsFix {
  id: string
  section: 'work' | 'summary'
  /** 'edit' rewrites existing text; 'generate' drafts new content (e.g. a missing summary). Absence means 'edit'. */
  kind?: 'edit' | 'generate'
  workIndex?: number
  highlightIndex?: number
  original: string
  suggested: string
  targetKeywords: string[]
  /** Numeric claims and skill/technology terms in `suggested` absent from the original text — require explicit user approval. */
  pendingApprovals: string[]
}

const RawFixSchema = z.object({
  // -1 is a sentinel reserved for drafting a brand-new summary.
  sectionIndex: z.number().int().min(-1),
  original: z.string(),
  suggested: z.string(),
  targetKeywords: z.array(z.string()),
})

interface EditableSection {
  section: 'work' | 'summary'
  workIndex?: number
  highlightIndex?: number
  text: string
  label: string
}

function buildEditableSections(data: ResumeData): EditableSection[] {
  const sections: EditableSection[] = []

  if (data.basics?.summary?.trim()) {
    sections.push({
      section: 'summary',
      text: data.basics.summary,
      label: 'Professional Summary',
    })
  }

  for (let wi = 0; wi < (data.work ?? []).length; wi++) {
    const job = data.work![wi]
    for (let hi = 0; hi < (job.highlights ?? []).length; hi++) {
      const text = job.highlights![hi]
      if (text?.trim()) {
        sections.push({
          section: 'work',
          workIndex: wi,
          highlightIndex: hi,
          text,
          label: `${job.position ?? 'Role'} at ${job.name ?? 'Company'} - bullet ${hi + 1}`,
        })
      }
    }
  }

  return sections
}

export async function runAtsFixPipeline(
  data: ResumeData,
  missingKeywords: string[]
): Promise<AtsFix[]> {
  const keywords = missingKeywords.slice(0, 20)
  if (keywords.length === 0) return []

  const sections = buildEditableSections(data)
  if (sections.length === 0) return []

  const sectionsText = sections
    .map((s, i) => `[${i}] ${s.label}: "${s.text}"`)
    .join('\n')

  const summaryMissing = !data.basics?.summary?.trim()

  const newSummaryInstruction = summaryMissing
    ? `

This resume has no professional summary. In addition to the edits above, you may include ONE entry with "sectionIndex": -1 to draft a brand-new 2-3 sentence professional summary tailored to the target job, grounded ONLY in facts already present in the resume sections listed above (skills, work history, highlights). Do not invent employers, job titles, dates, or metrics that are not already stated in the sections above. For that entry, set "original" to an empty string "".`
    : ''

  const prompt = `You are an expert resume writer optimizing a CV for ATS keyword coverage.

Missing keywords to incorporate: ${keywords.join(', ')}

Resume sections available to improve:
${sectionsText}

Propose up to 12 targeted edits across the sections above to naturally work in as many of the missing keywords as fit well - prioritize the summary and the two most recent roles, since those carry the most ATS weight. Not every keyword needs its own edit; a single strong edit may incorporate more than one keyword, and some low-value keywords may not fit anywhere naturally - skip those rather than forcing them in. Preserve factual accuracy - do not invent metrics, numbers, or experiences not implied by the original text. Do not use em dashes (—) in the suggested text; use a regular hyphen (-) or rephrase instead.${newSummaryInstruction}

Return a JSON array. Maximum 12 fixes. Each object:
{
  "sectionIndex": <index from the list above>,
  "original": "<exact original text unchanged>",
  "suggested": "<improved text with keyword(s) naturally woven in>",
  "targetKeywords": ["<keyword>"]
}

Return ONLY the JSON array, no other text.`

  const anthropic = getAnthropic()
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '[]'

  let raw: unknown
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    raw = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }

  if (!Array.isArray(raw)) return []

  const fixes: AtsFix[] = []
  for (const candidate of raw) {
    const parsed = RawFixSchema.safeParse(candidate)
    if (!parsed.success) continue
    const item = parsed.data

    if (item.sectionIndex === -1) {
      // Sentinel for drafting a brand-new summary. Only honored when the
      // resume genuinely lacks one — the prompt's conditionality is a
      // request, not a guarantee, so guard here too.
      if (!summaryMissing) continue
      if (!item.suggested.trim()) continue
      // No `original` exists to quote-match, so hallucination detection runs
      // against the full resume text instead.
      const fullText = flattenAllText(data)
      fixes.push({
        id: 'fix-summary-new',
        section: 'summary',
        kind: 'generate',
        original: '',
        suggested: item.suggested,
        targetKeywords: item.targetKeywords,
        pendingApprovals: detectHallucinations(fullText, item.suggested),
      })
      continue
    }

    const section = sections[item.sectionIndex]
    if (!section) continue
    // The model must quote the current resume text verbatim — a mismatch means
    // it targeted stale or invented content, and applying it would replace the
    // wrong text.
    if (item.original.trim() !== section.text.trim()) continue
    if (item.original.trim() === item.suggested.trim()) continue

    const id = section.section === 'summary'
      ? 'fix-summary'
      : `fix-work-${section.workIndex}-${section.highlightIndex}`

    fixes.push({
      id,
      section: section.section,
      kind: 'edit',
      workIndex: section.workIndex,
      highlightIndex: section.highlightIndex,
      original: item.original,
      suggested: item.suggested,
      targetKeywords: item.targetKeywords,
      pendingApprovals: detectHallucinations(section.text, item.suggested),
    })
  }

  return fixes
}
