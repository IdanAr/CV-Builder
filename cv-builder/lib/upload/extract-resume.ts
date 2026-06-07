import { getAnthropic } from '@/lib/ai/models'
import { ResumeDataSchema } from '@/lib/schemas/resume.zod'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExtractionError'
  }
}

const SYSTEM_PROMPT = `You are a CV parser. Extract structured data from the CV text and return ONLY a valid JSON object.

Rules:
- Only include fields explicitly stated in the text
- Dates must be strings in YYYY-MM or YYYY format
- skills[].keywords = flat array of individual skill strings
- If a section is absent, omit it entirely — do not return empty arrays
- Return raw JSON only — no markdown fences, no explanation, no prose

JSON shape (all fields optional):
{
  "basics": { "name", "label", "email", "phone", "url", "summary",
    "location": { "city", "region", "countryCode" },
    "profiles": [{ "network", "username", "url" }] },
  "work": [{ "name", "position", "startDate", "endDate", "summary", "highlights": [] }],
  "education": [{ "institution", "area", "studyType", "startDate", "endDate", "score" }],
  "skills": [{ "name", "keywords": [] }],
  "certificates": [{ "name", "date", "issuer" }],
  "awards": [{ "title", "date", "awarder", "summary" }],
  "publications": [{ "name", "publisher", "releaseDate", "summary" }],
  "volunteer": [{ "organization", "position", "startDate", "endDate", "summary" }],
  "languages": [{ "language", "fluency" }],
  "interests": [{ "name", "keywords": [] }],
  "projects": [{ "name", "description", "keywords": [], "startDate", "endDate" }]
}`

const MAX_TEXT_LENGTH = 50_000

export async function extractResume(text: string): Promise<ResumeData> {
  const truncated = text.slice(0, MAX_TEXT_LENGTH)
  const anthropic = getAnthropic()

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `CV text:\n\n${truncated}` }],
  })

  const block = msg.content[0]
  if (!block || block.type !== 'text') {
    throw new ExtractionError('Unexpected response from AI model')
  }

  let parsed: unknown
  try {
    const raw = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
    parsed = JSON.parse(raw)
  } catch {
    throw new ExtractionError('AI returned unstructured output. Please try again.')
  }

  const result = ResumeDataSchema.safeParse(sanitizeForSchema(parsed))
  return result.success ? result.data : (parsed as ResumeData)
}

function sanitizeForSchema(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const obj = data as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (Array.isArray(val)) {
      out[key] = val.map(sanitizeForSchema)
    } else if (val && typeof val === 'object') {
      out[key] = sanitizeForSchema(val)
    } else if (typeof val === 'string' && (key === 'url' || key === 'website')) {
      // Ensure URLs have a protocol so Zod's .url() validator doesn't reject them
      const withProtocol = /^https?:\/\//i.test(val) ? val : `https://${val}`
      out[key] = withProtocol
    } else {
      out[key] = val
    }
  }
  return out
}
