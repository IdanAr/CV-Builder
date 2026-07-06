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
  // Generic JD objective/connective/soft language — real, but not something a
  // resume should be scored against as a missing "keyword."
  'strong', 'excellent', 'ability', 'abilities', 'responsibilities', 'responsible',
  'responsibility', 'environment', 'candidate', 'candidates', 'opportunity',
  'opportunities', 'including', 'include', 'includes', 'included', 'years', 'year',
  'plus', 'preferred', 'required', 'requirement', 'requirements', 'skills', 'skill',
  'communication', 'collaborate', 'collaboration', 'collaborative', 'team', 'teams',
  'teamwork', 'must', 'looking', 'seeking', 'join', 'growing', 'dynamic',
  'passionate', 'similar', 'related', 'relevant', 'background', 'field',
  'industry', 'company', 'companies', 'organization', 'organizations', 'client',
  'clients', 'customer', 'customers', 'stakeholder', 'stakeholders', 'culture',
  'values', 'mission', 'vision', 'benefits', 'salary', 'compensation', 'equal',
  'employer', 'diversity', 'inclusion', 'apply', 'application', 'resume', 'cover',
  'letter', 'detail', 'oriented', 'self', 'starter', 'fast', 'paced', 'ensure',
  'ensuring', 'provide', 'providing', 'support', 'supporting', 'understanding',
  'knowledge', 'familiarity', 'familiar', 'proficient', 'proficiency',
  'demonstrate', 'demonstrated', 'strongly', 'highly', 'ideal', 'ideally',
  'help', 'helping', 'across', 'within', 'while', 'able', 'well', 'good',
  'new', 'make', 'making', 'take', 'taking', 'get', 'getting', 'set', 'setting',
])

// Common technologies, tools, platforms, and hard-skill/methodology terms.
// Any match here is always treated as crucial — deliberately not exhaustive,
// since the heuristics in extractKeywords() below (acronym/proper-noun casing,
// tech-punctuation, repeated emphasis) catch real terms this list misses.
const TECH_TERMS = new Set([
  'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'golang', 'go',
  'rust', 'php', 'ruby', 'rails', 'scala', 'perl', 'c++', 'c#', 'objective-c',
  'react', 'reactjs', 'vue', 'vuejs', 'angular', 'angularjs', 'svelte', 'nextjs',
  'next.js', 'nuxt', 'node', 'nodejs', 'node.js', 'express', 'django', 'flask',
  'fastapi', 'spring', 'springboot', '.net', 'dotnet', 'asp.net', 'laravel',
  'html', 'css', 'sass', 'scss', 'tailwind', 'bootstrap', 'redux', 'graphql',
  'rest', 'restful', 'grpc', 'websocket', 'microservices', 'webpack', 'vite',
  'aws', 'azure', 'gcp', 'ec2', 's3', 'lambda', 'cloudformation', 'kubernetes',
  'k8s', 'docker', 'terraform', 'ansible', 'puppet', 'chef', 'jenkins', 'gitlab',
  'github', 'bitbucket', 'git', 'cicd', 'ci/cd', 'devops', 'sre', 'linux',
  'unix', 'bash', 'shell', 'nginx', 'apache',
  'sql', 'nosql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'redis',
  'cassandra', 'dynamodb', 'elasticsearch', 'kafka', 'rabbitmq', 'spark',
  'hadoop', 'airflow', 'snowflake', 'databricks', 'bigquery', 'redshift',
  'tableau', 'powerbi', 'looker', 'excel',
  'tensorflow', 'pytorch', 'keras', 'scikit-learn', 'sklearn', 'pandas', 'numpy',
  'nlp', 'llm', 'genai', 'machine-learning', 'ml', 'ai',
  'salesforce', 'sap', 'jira', 'confluence', 'figma', 'sketch', 'photoshop',
  'illustrator', 'agile', 'scrum', 'kanban', 'waterfall', 'lean',
  'cybersecurity', 'networking', 'oauth', 'saml', 'jwt',
  'ios', 'android', 'flutter', 'reactnative', 'react-native', 'xamarin',
  'unity', 'unreal',
  'seo', 'sem', 'crm', 'erp', 'api', 'apis', 'json', 'xml', 'yaml',
])

function tokenizeWithCase(text: string): string[] {
  const cleaned = text.replace(/[^a-zA-Z0-9\s.+#/-]/g, ' ')
  return cleaned
    .split(/\s+/)
    .map(w => w.replace(/^[.\-/]+|[.\-/]+$/g, ''))
    .filter(Boolean)
}

/** True for tokens that look like acronyms or camel/Pascal-case product names
 * (AWS, SQL, JavaScript, GitHub) based on internal capitalization — a strong
 * signal of a real technical term regardless of a static dictionary. */
function looksLikeProperNounOrAcronym(raw: string): boolean {
  if (raw.length < 2) return false
  const isAllCapsAcronym = /^[A-Z0-9]+$/.test(raw) && /[A-Z]/.test(raw)
  const hasInternalCap = /[A-Z]/.test(raw.slice(1))
  return isAllCapsAcronym || hasInternalCap
}

export function extractKeywords(text: string): string[] {
  if (!text.trim()) return []

  const rawTokens = tokenizeWithCase(text)
  const counts = new Map<string, number>()
  const properNounSeen = new Map<string, boolean>()
  const order: string[] = []

  for (const raw of rawTokens) {
    const lower = raw.toLowerCase()
    if (lower.length < 3 || STOP_WORDS.has(lower)) continue
    if (!counts.has(lower)) order.push(lower)
    counts.set(lower, (counts.get(lower) ?? 0) + 1)
    if (looksLikeProperNounOrAcronym(raw)) properNounSeen.set(lower, true)
  }

  return order.filter((word) => {
    if (TECH_TERMS.has(word)) return true
    if (properNounSeen.get(word)) return true
    if (/[0-9+#]/.test(word) || word.includes('.') || word.includes('-')) return true
    if ((counts.get(word) ?? 0) >= 2) return true
    return false
  })
}

// Curated dictionary of well-known technology/skill terms (lowercase), used
// only by extractTechTerms() below — deliberately a separate, narrower set
// from TECH_TERMS above (which powers extractKeywords() for JD parsing).
// This one excludes tokens that double as ordinary English words in resume
// prose (e.g. "rest", "spring", "express", "chef", "puppet" — all present in
// the broader TECH_TERMS set) because precision matters more than recall for
// the hallucination guard: flagging "took a well-deserved rest" as an
// invented technology would be a worse failure than missing an occasional
// real one.
const SKILL_TERMS = new Set([
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

// Strict casing signal for product/technology names, used only by
// extractTechTerms() — deliberately separate (and stricter) than
// looksLikeProperNounOrAcronym() above, which extractKeywords() uses for JD
// parsing. This one does NOT count plain Capitalized words — those are
// usually just sentence-initial ("Led", "Built") — only all-caps acronyms of
// 3+ chars (AWS, SQL) and mixed-case names with an internal capital
// following a lowercase letter (LaunchDarkly, GitHub, PostgreSQL).
function looksLikeStrictAcronymOrCamelCase(token: string): boolean {
  if (/^[A-Z][A-Z0-9]{2,}$/.test(token)) return true
  if (/[a-z][A-Z]/.test(token)) return true
  return false
}

/**
 * Conservative technology/skill-term detector for short AI-generated text
 * (a single bullet or summary), used by the hallucination guard. Unlike
 * extractKeywords() — tuned for parsing long job descriptions — this only
 * matches the curated SKILL_TERMS dictionary or a strict proper-noun/acronym
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
    if (SKILL_TERMS.has(lower) || looksLikeStrictAcronymOrCamelCase(raw)) {
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
