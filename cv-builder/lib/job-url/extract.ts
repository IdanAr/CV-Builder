// Turns a job posting page into plain job-description text.
//
// Most applicant-tracking systems (Greenhouse, Lever, Workday, SmartRecruiters,
// Ashby, Comeet, and many company career sites) embed a schema.org
// `JobPosting` as JSON-LD for search engines. That is the cleanest source: it
// carries the description plus the title and company. When it is absent, the
// page body is reduced to text, preferring <main>/<article> over the whole
// document so navigation and footers do not end up in the cover letter prompt.

export interface ExtractedJob {
  text: string
  title?: string
  company?: string
  source: 'structured' | 'page'
}

const MAX_TEXT = 10_000

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-',
  hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', bull: '•', middot: '·',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? m
  })
}

/** HTML fragment to readable text: block tags become line breaks, list items become bullets. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(p|div|section|article|ul|ol|h[1-6]|tr|table|header|footer|blockquote)>/gi, '\n')
    .replace(/<(p|div|section|h[1-6]|ul|ol|table|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/[ \t\f\v ]+/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .filter((l, i, all) => l !== '' || (i > 0 && all[i - 1] !== ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function asArray<T>(v: T | T[] | undefined): T[] {
  return v === undefined ? [] : Array.isArray(v) ? v : [v]
}

function isJobPosting(node: Record<string, unknown>): boolean {
  return asArray(node['@type'] as string | string[] | undefined).some((t) => String(t).toLowerCase() === 'jobposting')
}

function findJobPosting(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || node === null || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const n of node) {
      const hit = findJobPosting(n, depth + 1)
      if (hit) return hit
    }
    return null
  }
  const obj = node as Record<string, unknown>
  if (isJobPosting(obj)) return obj
  for (const key of ['@graph', 'mainEntity', 'itemListElement']) {
    const hit = findJobPosting(obj[key], depth + 1)
    if (hit) return hit
  }
  return null
}

function structured(html: string): ExtractedJob | null {
  const blocks = html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, raw] of blocks) {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw.trim())
    } catch {
      continue
    }
    const job = findJobPosting(parsed)
    if (!job || typeof job.description !== 'string') continue
    // Some sites double-encode the description (`&lt;p&gt;`), so decode before stripping tags.
    const text = htmlToText(job.description.includes('&lt;') ? decodeEntities(job.description) : job.description)
    if (!text) continue
    const org = job.hiringOrganization
    const company = typeof org === 'string' ? org : typeof (org as { name?: unknown })?.name === 'string' ? (org as { name: string }).name : undefined
    return {
      text,
      title: typeof job.title === 'string' ? decodeEntities(job.title).trim() : undefined,
      company: company ? decodeEntities(company).trim() : undefined,
      source: 'structured',
    }
  }
  return null
}

function pageText(html: string): ExtractedJob {
  const withoutChrome = html
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<(nav|header|footer|form|aside)\b[\s\S]*?<\/\1>/gi, '')
  const main = withoutChrome.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? withoutChrome.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
  const body = withoutChrome.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? withoutChrome
  const mainText = main ? htmlToText(main) : ''
  const text = mainText.length >= 300 ? mainText : htmlToText(body)
  const og = html.match(/<meta\b[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i)?.[1]
  const titleTag = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const title = decodeEntities((og ?? titleTag ?? '').trim()) || undefined
  return { text, title, source: 'page' }
}

export function extractJobDescription(html: string): ExtractedJob {
  const job = structured(html) ?? pageText(html)
  return { ...job, text: job.text.slice(0, MAX_TEXT) }
}
