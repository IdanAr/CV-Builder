const STOP_WORDS = new Set([
  'and', 'or', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'ought', 'used',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into',
  'through', 'during', 'before', 'after', 'above', 'below', 'between',
  'out', 'off', 'over', 'under', 'again', 'then', 'once', 'but', 'not',
  'than', 'too', 'very', 'that', 'this', 'these', 'those', 'such', 'both',
  'each', 'few', 'more', 'most', 'other', 'some', 'any', 'all', 'also',
  'our', 'your', 'their', 'we', 'you', 'they', 'he', 'she', 'it',
  'who', 'which', 'what', 'how', 'when', 'where', 'why',
  'work', 'working', 'experience', 'role', 'position', 'job',
])

export function extractKeywords(text: string): string[] {
  if (!text.trim()) return []
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/\.$/, ''))
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w))
    .filter((w, i, arr) => arr.indexOf(w) === i)
}

// Curated dictionary of well-known technology/skill terms (lowercase).
// Deliberately excludes tokens that double as ordinary English words in
// resume prose (e.g. "rest", "spring", "express", "chef", "puppet") —
// precision matters more than recall for the hallucination guard.
const TECH_TERMS = new Set([
  'kubernetes', 'docker', 'terraform', 'ansible', 'jenkins', 'helm',
  'aws', 'azure', 'gcp', 'lambda', 'ec2', 'cloudformation',
  'react', 'angular', 'vue', 'svelte', 'nextjs', 'next.js', 'nuxt',
  'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift',
  'golang', 'rust', 'scala', 'ruby', 'php', 'perl', 'c++', 'c#',
  'node.js', 'nodejs', 'deno', 'django', 'flask', 'fastapi', 'rails',
  'laravel', 'dotnet', '.net', 'graphql', 'grpc', 'oauth', 'jwt',
  'sql', 'nosql', 'postgresql', 'postgres', 'mysql', 'mongodb',
  'redis', 'sqlite', 'dynamodb', 'elasticsearch', 'cassandra',
  'kafka', 'rabbitmq', 'spark', 'hadoop', 'airflow', 'snowflake',
  'databricks', 'redshift', 'bigquery', 'tableau', 'looker',
  'pandas', 'numpy', 'pytorch', 'tensorflow', 'scikit-learn', 'keras',
  'git', 'github', 'gitlab', 'bitbucket', 'jira', 'confluence',
  'figma', 'salesforce', 'hubspot', 'segment', 'datadog', 'grafana',
  'prometheus', 'splunk', 'sentry', 'pagerduty',
  'nginx', 'apache', 'linux', 'bash', 'powershell',
  'webpack', 'vite', 'babel', 'tailwind', 'sass', 'bootstrap',
  'jest', 'vitest', 'cypress', 'selenium', 'playwright', 'storybook',
  'html', 'css', 'json', 'xml', 'yaml', 'matlab',
])

// Tokenizer that preserves original casing so downstream checks can use
// casing signals (acronyms, PascalCase). Keeps ., +, # inside tokens for
// terms like "node.js", "c++", "c#"; strips leading/trailing dots.
function tokenizeWithCase(text: string): string[] {
  return text
    .replace(/[^a-zA-Z0-9\s.+#]/g, ' ')
    .split(/\s+/)
    .map(w => w.replace(/^\.+|\.+$/g, ''))
    .filter(Boolean)
}

// Strict casing signal for product/technology names. Deliberately does NOT
// count plain Capitalized words — those are usually just sentence-initial
// ("Led", "Built") — only all-caps acronyms (AWS, SQL) and mixed-case names
// with an internal capital following a lowercase letter (LaunchDarkly,
// GitHub, PostgreSQL).
function looksLikeProperNounOrAcronym(token: string): boolean {
  if (/^[A-Z][A-Z0-9]{2,}$/.test(token)) return true
  if (/[a-z][A-Z]/.test(token)) return true
  return false
}

/**
 * Conservative technology/skill-term detector for short AI-generated text
 * (a single bullet or summary), used by the hallucination guard. Unlike
 * extractKeywords() — tuned for parsing long job descriptions — this only
 * matches the curated TECH_TERMS dictionary or a strict proper-noun/acronym
 * casing signal. It deliberately skips the hyphen/digit/repetition
 * heuristics extractKeywords uses, since those produce false positives on
 * short text (e.g. flagging the ordinary phrase "cross-functional" as an
 * invented technology).
 */
export function extractTechTerms(text: string): string[] {
  const rawTokens = tokenizeWithCase(text)
  const seen = new Set<string>()
  const found: string[] = []
  for (const raw of rawTokens) {
    const lower = raw.toLowerCase()
    if (lower.length < 3 || seen.has(lower)) continue
    if (TECH_TERMS.has(lower) || looksLikeProperNounOrAcronym(raw)) {
      seen.add(lower)
      found.push(lower)
    }
  }
  return found
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchesKeyword(text: string, keyword: string): boolean {
  const pattern = new RegExp(
    `(?<![a-z0-9])${escapeRegExp(keyword.toLowerCase())}(?![a-z0-9])`,
    'i'
  )
  return pattern.test(text)
}

export function keywordOverlap(
  resumeText: string,
  jdKeywords: string[]
): { matched: string[]; missing: string[] } {
  const lower = resumeText.toLowerCase()
  const matched: string[] = []
  const missing: string[] = []
  for (const kw of jdKeywords) {
    if (matchesKeyword(lower, kw)) matched.push(kw)
    else missing.push(kw)
  }
  return { matched, missing }
}
