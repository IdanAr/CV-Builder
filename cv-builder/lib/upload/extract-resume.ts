import { randomUUID } from 'crypto'
import { getAnthropic, DEFAULT_MODEL } from '@/lib/ai/models'
import { ResumeDataSchema, CUSTOM_SECTION_FIELDS } from '@/lib/schemas/resume.zod'
import type { ResumeData, CustomSection, CustomSectionItem, CustomSectionFieldType, WorkRole, EducationRole, CustomSectionRole } from '@/lib/schemas/resume.zod'

export class ExtractionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExtractionError'
  }
}

const SYSTEM_PROMPT = `You are a CV parser. Extract structured data from the CV text and return ONLY a valid JSON object.

Rules:
- Only include fields explicitly stated in the text
- Dates must be strings in YYYY-MM or YYYY format. Only write startDate/endDate when the text actually contains a date range (a start date, or a start–end pair) next to that entry. Within a real date range, if the end side is expressed as ongoing (e.g. "Present", "Current", "Currently", "Now", "Ongoing", "Till date", regardless of capitalization) instead of a date, write endDate as the literal string "Present" - that is this app's sentinel for "still ongoing". This rule applies identically to EVERY real date range in the document - work, education, volunteer, projects, and custom-section roles alike; a résumé commonly has more than one thing still ongoing at once (e.g. a current job AND a degree in progress), so check each date range on its own, don't assume only one entry can be "Present". Only omit endDate when a startDate exists but no end is given at all; never guess or default to "Present" in that case. Example: "Technion  12/2025 – Present" → {"startDate": "2025-12", "endDate": "Present"} - not just {"startDate": "2025-12"}. Do NOT invent a date range from a status label that isn't a date - e.g. a project titled "CV-Builder (Active Development)" with no date printed anywhere near it gets no startDate and no endDate at all; "(Active Development)"/"(Ongoing)"/"(WIP)" next to a title is a status word, not a date
- skills[].keywords = flat array of individual skill strings
- If a section is absent, omit it entirely - do not return empty arrays
- Any CV section that does not map to a field below (e.g. Military Service, Courses, Achievements) goes into customSections with its original heading as "name" - never discard section content
- Military service is not volunteer work and not employment - it always goes into customSections
- Every "work" entry's job title(s) and every "education" entry's degree(s) always go in that entry's "roles" array - never on the entry's own top-level fields, even when the company/institution has only one role. "roles" always has at least one element for every work/education entry
- A company or institution can list more than one role in two different text shapes: (a) each title has its own date range printed next to it, or (b) ONE date range is printed once for the whole company/institution block and multiple title lines follow it with no date of their own (a promotion/role change within one tenure - the title lines are still each role's own heading, distinct from the summary/bullet text that follows them). Recognize both shapes as multi-role; in shape (b), leave startDate/endDate blank on every role that has no date printed next to its own title - do not invent one or copy the block's shared date onto it
- Count roles strictly by the number of distinct title lines actually printed for that company/institution - never merge two differently-titled roles into one, and never split a single title into two roles. List roles in the exact top-to-bottom order they are printed in the source text - do not reorder them by guessing which is more recent
- Keep each bullet point as its own separate string in the "highlights" array of whichever role's title it physically appears under in the text - copy it verbatim, do not paraphrase it into a "summary" sentence, do not move it to a different role, and do not repeat it under more than one role
- Apply the same one-role-per-title, verbatim-bullet, source-order rules to a Military Service customSections item when it lists more than one rank or role in sequence - group those into that item's "roles" array the same way
- Do not generate ids
- Return raw JSON only - no markdown fences, no explanation, no prose

JSON shape (all fields optional):
{
  "basics": { "name", "label", "email", "phone", "url", "summary",
    "location": { "city", "region", "countryCode" },
    "profiles": [{ "label", "network", "username", "url" }] },
  "work": [{ "name",
    "roles": [{ "position", "startDate", "endDate", "summary", "highlights": [] }] }],
  "education": [{ "institution",
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
    model: DEFAULT_MODEL,
    max_tokens: 4096,
    // Extraction must be deterministic — the same CV text uploaded twice
    // should parse the same way. Uncontrolled sampling (the SDK default)
    // was the main source of run-to-run differences in role/bullet splitting.
    temperature: 0,
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

  const normalized = assignRoleIds(normalizeCustomSections(assignProfileIds(sanitizeForSchema(dropOrphanEndDates(normalizeOngoingDates(parsed))))))
  const result = ResumeDataSchema.safeParse(normalized)
  if (!result.success) {
    throw new ExtractionError('AI returned data that did not match the expected resume format. Please try again.')
  }
  return patchAnchoredPresentDates(truncated, result.data)
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

// Safety net independent of the prompt: however the model phrases an
// ongoing end date ("Current", "Currently", "Now", "Ongoing", "Till date",
// any capitalization), coerce it to the literal "Present" sentinel this app
// renders/edits as the isPresent checkbox — never leave a synonym sitting
// in endDate unrecognized by MonthYearPicker/formatDateRange.
const ONGOING_DATE_PATTERN = /^(present|current(ly)?|now|ongoing|till date|to date|till now|to present|to now|actual)$/i

function normalizeOngoingDates(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(normalizeOngoingDates)
  if (!data || typeof data !== 'object') return data
  const obj = data as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'endDate' && typeof val === 'string' && ONGOING_DATE_PATTERN.test(val.trim())) {
      out[key] = 'Present'
    } else if (Array.isArray(val) || (val && typeof val === 'object')) {
      out[key] = normalizeOngoingDates(val)
    } else {
      out[key] = val
    }
  }
  return out
}

// Backstop for the model inventing an endDate (occasionally "Present") next
// to a title that has no date range at all — e.g. a status label like
// "(Active Development)" that isn't a date but got read as one. An endDate
// with no startDate is meaningless in this app's model (there's nothing to
// range from), so drop it outright rather than trust the model's read.
function dropOrphanEndDates(data: unknown): unknown {
  if (Array.isArray(data)) return data.map(dropOrphanEndDates)
  if (!data || typeof data !== 'object') return data
  const obj = data as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(obj)) {
    out[key] = Array.isArray(val) || (val && typeof val === 'object') ? dropOrphanEndDates(val) : val
  }
  if (out.endDate && !out.startDate) delete out.endDate
  return out
}

// Second, independent safety net: normalizeOngoingDates only catches an
// ongoing marker the model already decided to put in endDate. In practice
// the model sometimes drops endDate entirely for one entry while getting a
// sibling entry in the very same document right (observed: a work entry and
// an in-progress-degree education entry in the same CV, both ending
// "Present" in the source text — the model wrote "Present" for the job but
// silently omitted endDate for the degree). Since that failure is the model
// never emitting a value at all, no amount of post-hoc string matching on
// its output can catch it — so this scans the original CV text directly for
// "<name> ... <year> - Present/Current/..." lines and force-fills endDate
// on the matching entry only when the model left it blank and a startDate
// is otherwise present. Deliberately conservative: it fills gaps, it never
// overrides a value the model actually produced.
const ONGOING_WORD_PATTERN = /\b(present|current(?:ly)?|now|ongoing|till date|to date|till now|to present|to now|actual)\b/i
const YEAR_PATTERN = /(19|20)\d{2}/

function findOngoingAnchors(sourceText: string): string[] {
  const anchors: string[] = []
  for (const line of sourceText.split('\n')) {
    if (!ONGOING_WORD_PATTERN.test(line)) continue
    const yearMatch = YEAR_PATTERN.exec(line)
    if (!yearMatch) continue
    const anchor = line.slice(0, yearMatch.index).replace(/\t/g, ' ').trim().toLowerCase()
    if (anchor) anchors.push(anchor)
  }
  return anchors
}

function matchesAnchor(name: string | undefined, anchors: string[]): boolean {
  const n = name?.trim().toLowerCase()
  if (!n) return false
  return anchors.some((a) => a.includes(n) || n.includes(a))
}

function patchLastOpenRole<T extends { startDate?: string; endDate?: string }>(roles: T[] | undefined): T[] | undefined {
  if (!roles || roles.length === 0) return roles
  const lastOpenIndex = [...roles].reverse().findIndex((r) => r.startDate && !r.endDate)
  if (lastOpenIndex === -1) return roles
  const index = roles.length - 1 - lastOpenIndex
  return roles.map((r, i) => (i === index ? { ...r, endDate: 'Present' } : r))
}

function patchAnchoredPresentDates(sourceText: string, data: ResumeData): ResumeData {
  const anchors = findOngoingAnchors(sourceText)
  if (anchors.length === 0) return data

  return {
    ...data,
    work: data.work?.map((w) =>
      matchesAnchor(w.name, anchors) ? { ...w, roles: patchLastOpenRole<WorkRole>(w.roles) } : w
    ),
    education: data.education?.map((e) =>
      matchesAnchor(e.institution, anchors) ? { ...e, roles: patchLastOpenRole<EducationRole>(e.roles) } : e
    ),
    volunteer: data.volunteer?.map((v) =>
      matchesAnchor(v.organization, anchors) && v.startDate && !v.endDate ? { ...v, endDate: 'Present' } : v
    ),
    customSections: data.customSections?.map((cs) => ({
      ...cs,
      items: cs.items.map((item) => {
        if (!matchesAnchor(item.title, anchors)) return item
        if (item.roles && item.roles.length > 0) {
          return { ...item, roles: patchLastOpenRole<CustomSectionRole>(item.roles) }
        }
        return item.startDate && !item.endDate ? { ...item, endDate: 'Present' } : item
      }),
    })),
  }
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
