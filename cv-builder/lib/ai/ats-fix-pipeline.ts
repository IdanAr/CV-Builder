import { getAnthropic } from './models'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export interface AtsFix {
  id: string
  section: 'work' | 'summary'
  workIndex?: number
  highlightIndex?: number
  original: string
  suggested: string
  targetKeywords: string[]
}

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

  const prompt = `You are an expert resume writer optimizing a CV for ATS keyword coverage.

Missing keywords to incorporate: ${keywords.join(', ')}

Resume sections available to improve:
${sectionsText}

For each missing keyword, suggest ONE targeted edit to a section that naturally incorporates the keyword. Preserve factual accuracy - do not invent metrics, numbers, or experiences not implied by the original text.

Return a JSON array. Maximum 8 fixes. Each object:
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
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const responseText = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '[]'

  let raw: Array<{ sectionIndex: number; original: string; suggested: string; targetKeywords: string[] }>
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    raw = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    return []
  }

  if (!Array.isArray(raw)) return []

  const fixes: AtsFix[] = []
  for (const item of raw) {
    const section = sections[item.sectionIndex]
    if (!section) continue
    if (typeof item.original !== 'string' || typeof item.suggested !== 'string') continue
    if (item.original.trim() === item.suggested.trim()) continue

    fixes.push({
      id: `fix-${fixes.length}`,
      section: section.section,
      workIndex: section.workIndex,
      highlightIndex: section.highlightIndex,
      original: item.original,
      suggested: item.suggested,
      targetKeywords: Array.isArray(item.targetKeywords) ? item.targetKeywords : [],
    })
  }

  return fixes
}
