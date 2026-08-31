// Resolves a Comeet UID + token pair from a company's own public careers page
// URL (e.g. https://www.comeet.com/jobs/dealhub/86.005), so the JobSearch
// wizard can offer "paste the company's careers page URL" instead of asking a
// non-technical user to dig a UID and a 40-character token out of that page's
// source themselves.
//
// Verified directly against a live page with a plain server-side GET (no JS
// execution, matching what this function's own fetch() sees): the page is
// server-rendered with a `COMPANY_DATA = {...};` object assignment already
// present in the raw HTML — not injected later by client-side JS. That JSON
// uses snake_case keys (`company_uid`, `token`, `name`), which is *different*
// from the camelCase (`companyUid`) exposed on `window.COMPANY_DATA` after
// Comeet's own Angular app transforms it client-side — a server-side fetch
// only ever sees the raw snake_case form below.
const ALLOWED_HOSTS = new Set(['comeet.com', 'www.comeet.com'])

export interface ResolvedComeetCompany {
  name: string
  uid: string
  token: string
}

export type ResolveComeetCompanyResult =
  | { ok: true; company: ResolvedComeetCompany }
  | { ok: false; error: string }

function validateUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    // Whitelisted to comeet.com only — this function fetches whatever URL the
    // caller supplies, so without this check it would be an open SSRF vector
    // (a user-controlled server-side fetch to an arbitrary host/port).
    if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null
    return url
  } catch {
    return null
  }
}

// Extracts the `COMPANY_DATA = {...}` object literal from the page's raw HTML
// via string-aware brace counting (not a naive regex up to the first `};`),
// since the object's own string values (e.g. the HTML `description` field)
// can themselves legitimately contain `{`/`}` characters.
function extractCompanyData(html: string): unknown {
  const marker = 'COMPANY_DATA = '
  const markerIndex = html.indexOf(marker)
  if (markerIndex === -1) return null
  const jsonStart = markerIndex + marker.length
  if (html[jsonStart] !== '{') return null

  let depth = 0
  let inString = false
  let escaped = false
  for (let i = jsonStart; i < html.length; i++) {
    const ch = html[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(jsonStart, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}

function toResolvedCompany(data: unknown): ResolvedComeetCompany | null {
  if (typeof data !== 'object' || data === null) return null
  const d = data as Record<string, unknown>
  const name = typeof d.name === 'string' ? d.name.trim() : ''
  const uid = typeof d.company_uid === 'string' ? d.company_uid.trim() : ''
  const token = typeof d.token === 'string' ? d.token.trim() : ''
  if (!name || !uid || !token) return null
  return { name, uid, token }
}

export async function resolveComeetCompanyFromUrl(rawUrl: string): Promise<ResolveComeetCompanyResult> {
  const url = validateUrl(rawUrl)
  if (!url) {
    return { ok: false, error: 'Enter a valid comeet.com careers page URL (e.g. comeet.com/jobs/company-name/uid).' }
  }

  let res: Response
  try {
    res = await fetch(url.toString(), { signal: AbortSignal.timeout(10_000) })
  } catch {
    return { ok: false, error: 'Could not reach that page. Check the URL and try again.' }
  }
  if (!res.ok) {
    return { ok: false, error: `That page returned an error (${res.status}). Check the URL and try again.` }
  }

  const html = await res.text()
  const company = toResolvedCompany(extractCompanyData(html))
  if (!company) {
    return { ok: false, error: "Could not find company data on that page - make sure it's a company's own Comeet careers page." }
  }
  return { ok: true, company }
}
