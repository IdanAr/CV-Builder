import { randomUUID } from 'crypto'
import { getAnthropic } from '@/lib/ai/models'
import { ResumeDataSchema, CUSTOM_SECTION_FIELDS } from '@/lib/schemas/resume.zod'
import type { ResumeData, CustomSection, CustomSectionItem, CustomSectionFieldType } from '@/lib/schemas/resume.zod'

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
- Any CV section that does not map to a field below (e.g. Military Service, Courses, Achievements) goes into customSections with its original heading as "name" — never discard section content
- Military service is not volunteer work and not employment — it always goes into customSections
- When the CV text shows the same company or institution with more than one title/date-range pair in sequence (e.g. two job titles under one employer, or two degrees at one school), emit ONE entry with the earliest role's fields as the top-level position/startDate/endDate/summary/highlights, and put every additional role in that entry's "roles" array with the same per-role fields — do not emit separate top-level entries for each title
- Apply the same grouping to a Military Service customSections item when it lists more than one rank or role in sequence
- Do not generate ids
- Return raw JSON only — no markdown fences, no explanation, no prose

JSON shape (all fields optional):
{
  "basics": { "name", "label", "email", "phone", "url", "summary",
    "location": { "city", "region", "countryCode" },
    "profiles": [{ "label", "network", "username", "url" }] },
  "work": [{ "name", "position", "startDate", "endDate", "summary", "highlights": [],
    "roles": [{ "position", "startDate", "endDate", "summary", "highlights": [] }] }],
  "education": [{ "institution", "area", "studyType", "startDate", "endDate", "score",
    "roles": [{ "studyType", "area", "startDate", "endDate", "score" }] }],
  "skills": [{ "name", "keywords": [] }],
  "certificates": [{ "name", "date", "issuer" }],
  "awards": [{ "title", "date", "awarder", "summary" }],
  "publications": [{ "name", "publisher", "releaseDate", "summary" }],
  "volunteer": [{ "organization", "position", "startDate", "endDate", "summary" }],
  "languages": [{ "language", "fluency" }],
  "interests": [{ "name", "keywords": [] }],
  "projects": [{ "name", "description", "keywords": [], "startDate", "endDate" }],
  "customSections": [{ "name", "items": [{ "title", "subtitle", "url", "startDate", "endDate", "summary", "highlights": [], "keywords": [],
    "roles": [{ "title", "subtitle", "startDate", "endDate", "summary", "highlights": [] }] }] }]
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

  const normalized = assignRoleIds(normalizeCustomSections(assignProfileIds(sanitizeForSchema(parsed))))
  const result = ResumeDataSchema.safeParse(normalized)
  if (!result.success) {
    throw new ExtractionError('AI returned data that did not match the expected resume format. Please try again.')
  }
  return result.data
}

// The editor and templates only render work/education/skills/volunteer/languages
// plus custom sections — these standard JSON Resume fields would otherwise be
// extracted into the schema but never shown anywhere, so convert them.
const UNRENDERED_SECTION_CONVERSIONS: Array<{
  key: string
  name: string
  toItem: (raw: Record<string, unknown>) => Omit<CustomSectionItem, 'id'>
}> = [
  {
    key: 'projects',
    name: 'Projects',
    toItem: (p) => ({
      title: str(p.name), subtitle: undefined, url: str(p.url),
      startDate: str(p.startDate), endDate: str(p.endDate),
      summary: str(p.description), highlights: strArr(p.highlights), keywords: strArr(p.keywords),
    }),
  },
  {
    key: 'certificates',
    name: 'Certificates',
    toItem: (c) => ({ title: str(c.name), subtitle: str(c.issuer), url: str(c.url), startDate: str(c.date) }),
  },
  {
    key: 'awards',
    name: 'Awards',
    toItem: (a) => ({ title: str(a.title), subtitle: str(a.awarder), startDate: str(a.date), summary: str(a.summary) }),
  },
  {
    key: 'publications',
    name: 'Publications',
    toItem: (p) => ({ title: str(p.name), subtitle: str(p.publisher), url: str(p.url), startDate: str(p.releaseDate), summary: str(p.summary) }),
  },
  {
    key: 'interests',
    name: 'Interests',
    toItem: (i) => ({ title: str(i.name), keywords: strArr(i.keywords) }),
  },
]

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined
}

function strArr(v: unknown): string[] | undefined {
  return Array.isArray(v) && v.length > 0 ? v.filter((x): x is string => typeof x === 'string') : undefined
}

function deriveEnabledFields(items: CustomSectionItem[]): CustomSectionFieldType[] {
  const enabled = new Set<CustomSectionFieldType>()
  for (const item of items) {
    for (const field of CUSTOM_SECTION_FIELDS) {
      if (field === 'dateRange') continue
      const val = item[field]
      if (Array.isArray(val) ? val.length > 0 : val) enabled.add(field)
    }
    if (item.startDate || item.endDate) enabled.add('dateRange')
  }
  return CUSTOM_SECTION_FIELDS.filter((f) => enabled.has(f))
}

function withDerivedFields(name: string, items: Array<Omit<CustomSectionItem, 'id'>>): CustomSection {
  const withIds = items.map((item) => ({ ...item, id: randomUUID() }))
  return { id: randomUUID(), name, enabledFields: deriveEnabledFields(withIds), items: withIds }
}

function normalizeCustomSections(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const obj = { ...(data as Record<string, unknown>) }
  const sections: CustomSection[] = []

  // AI-returned custom sections arrive without ids or enabledFields
  if (Array.isArray(obj.customSections)) {
    for (const raw of obj.customSections) {
      if (!raw || typeof raw !== 'object') continue
      const cs = raw as Record<string, unknown>
      const name = str(cs.name)
      const items = Array.isArray(cs.items) ? cs.items : []
      if (!name || items.length === 0) continue
      sections.push(withDerivedFields(name, items.map((item: Record<string, unknown>) => ({
        title: str(item.title), subtitle: str(item.subtitle), url: str(item.url),
        startDate: str(item.startDate), endDate: str(item.endDate),
        summary: str(item.summary), highlights: strArr(item.highlights),
        keywords: strArr(item.keywords), level: str(item.level),
        roles: Array.isArray(item.roles) ? item.roles : undefined,
      }))))
    }
  }

  for (const { key, name, toItem } of UNRENDERED_SECTION_CONVERSIONS) {
    const raw = obj[key]
    if (Array.isArray(raw) && raw.length > 0) {
      const items = raw
        .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
        .map(toItem)
        .filter((item) => item.title)
      if (items.length > 0) sections.push(withDerivedFields(name, items))
    }
    delete obj[key]
  }

  if (sections.length > 0) obj.customSections = sections
  else delete obj.customSections
  return obj
}

// The prompt explicitly tells the model not to generate ids, but ProfileSchema.id
// is required — assign one to each AI-returned profile before schema validation.
function assignProfileIds(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const obj = data as Record<string, unknown>
  const basics = obj.basics
  if (!basics || typeof basics !== 'object' || Array.isArray(basics)) return data
  const b = basics as Record<string, unknown>
  if (!Array.isArray(b.profiles)) return data
  return {
    ...obj,
    basics: {
      ...b,
      profiles: b.profiles.map((p) => (p && typeof p === 'object' ? { id: randomUUID(), ...p } : p)),
    },
  }
}

// The prompt tells the model to group consecutive same-company/institution
// roles into a "roles" array but not to generate ids — WorkRoleSchema,
// EducationRoleSchema, and CustomSectionRoleSchema all require one, so assign
// them here, after normalizeCustomSections (which is what moves AI-returned
// customSections items — and their nested roles — into their final shape).
function assignRoleIds(data: unknown): unknown {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data
  const obj = { ...(data as Record<string, unknown>) }

  const withRoleIds = (entry: unknown): unknown => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return entry
    const e = entry as Record<string, unknown>
    if (!Array.isArray(e.roles)) return e
    return { ...e, roles: e.roles.map((r) => (r && typeof r === 'object' ? { id: randomUUID(), ...r } : r)) }
  }

  if (Array.isArray(obj.work)) obj.work = obj.work.map(withRoleIds)
  if (Array.isArray(obj.education)) obj.education = obj.education.map(withRoleIds)
  if (Array.isArray(obj.customSections)) {
    obj.customSections = obj.customSections.map((section: unknown) => {
      if (!section || typeof section !== 'object' || Array.isArray(section)) return section
      const s = section as Record<string, unknown>
      if (!Array.isArray(s.items)) return s
      return { ...s, items: s.items.map(withRoleIds) }
    })
  }
  return obj
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
