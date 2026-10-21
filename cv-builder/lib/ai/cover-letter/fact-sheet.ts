// lib/ai/cover-letter/fact-sheet.ts
// Turns a CV into numbered facts, each tagged with where it comes from
// (section, employer or institution, title, dates). The writer may only state
// candidate facts it cites by ID, and the verifier checks each sentence
// against the facts it cites, which is what makes misattribution visible.
// flattenAllText() lost exactly this: job boundaries, dates and which
// institution a credential belongs to.
import { resolveEducationRoles, resolveWorkRoles } from '@/lib/roles'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { foldName, nameVariants } from './names'

export type FactSection =
  | 'summary' | 'work' | 'education' | 'certificate' | 'award' | 'project'
  | 'volunteer' | 'publication' | 'skills' | 'language' | 'custom'

export interface FactSource {
  section: FactSection
  /** Employer, institution, issuer, project or item names, as the CV writes them. */
  names: string[]
  title?: string
  start?: string
  end?: string
  /** Single-date entries (certificates, awards, publications). */
  date?: string
}

export interface Fact {
  id: string
  source: FactSource
  text: string
  /** The entry's own title-and-dates line, as opposed to one of its bullets. */
  header: boolean
}

export interface KnownName {
  name: string
  variants: string[]
  /** 'org': employer, institution, issuer; 'title': certificate, project, award or item names. */
  kind: 'org' | 'title'
}

export interface FactSheet {
  facts: Fact[]
  knownNames: KnownName[]
  candidateName?: string
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+(?=[A-Z])/

function range(start?: string, end?: string): string {
  if (!start && !end) return ''
  return `${start ?? '?'} to ${end ?? 'present'}`
}

const join = (...parts: (string | undefined)[]) => parts.map((p) => p?.trim()).filter(Boolean).join(', ')
const clean = (s?: string) => s?.trim() || undefined

export function buildFactSheet(data: ResumeData): FactSheet {
  const facts: Fact[] = []
  const names = new Map<string, KnownName>()

  const add = (source: FactSource, text: string | undefined, header = false) => {
    const t = text?.trim()
    if (t) facts.push({ id: `F${facts.length + 1}`, source, text: t, header })
  }
  // Organisations get shortened forms ("Bright Path" for "Bright Path
  // Software"); titles of certificates, projects and items only match whole.
  const known = (name: string | undefined, kind: 'org' | 'title') => {
    const n = clean(name)
    if (!n) return
    const key = foldName(n)
    if (!key || names.has(key)) return
    const variants = kind === 'org' ? nameVariants(n) : [key]
    if (variants.length > 0) names.set(key, { name: n, variants, kind })
  }
  const named = (...list: (string | undefined)[]) => list.map(clean).filter((n): n is string => Boolean(n))

  for (const sentence of (data.basics?.summary ?? '').split(SENTENCE_SPLIT)) add({ section: 'summary', names: [] }, sentence)

  for (const job of data.work ?? []) {
    const employer = clean(job.name)
    known(employer, 'org')
    const jobNames = named(employer)
    if (job.description) add({ section: 'work', names: jobNames }, `${employer ? `${employer}: ` : ''}${job.description}`)
    for (const role of resolveWorkRoles(job)) {
      const source: FactSource = { section: 'work', names: jobNames, title: clean(role.position), start: clean(role.startDate), end: clean(role.endDate) }
      const head = [source.title, employer].filter(Boolean).join(' at ')
      add(source, join(head, range(source.start, source.end)), true)
      for (const s of (role.summary ?? '').split(SENTENCE_SPLIT)) add(source, s)
      for (const h of role.highlights ?? []) add(source, h)
    }
  }

  for (const edu of data.education ?? []) {
    const institution = clean(edu.institution)
    known(institution, 'org')
    for (const role of resolveEducationRoles(edu)) {
      const title = clean([role.studyType, role.area].filter(Boolean).join(' '))
      const source: FactSource = { section: 'education', names: named(institution), title, start: clean(role.startDate), end: clean(role.endDate) }
      add(source, join(title, institution, range(source.start, source.end), role.score && `score ${role.score}`), true)
      if (role.courses?.length) add(source, `Courses: ${role.courses.join(', ')}`)
    }
  }

  for (const cert of data.certificates ?? []) {
    known(cert.name, 'title')
    known(cert.issuer, 'org')
    const source: FactSource = { section: 'certificate', names: named(cert.name, cert.issuer), date: clean(cert.date) }
    add(source, join(cert.name, cert.issuer && `issued by ${cert.issuer.trim()}`, source.date), true)
  }

  for (const award of data.awards ?? []) {
    known(award.title, 'title')
    known(award.awarder, 'org')
    const source: FactSource = { section: 'award', names: named(award.title, award.awarder), date: clean(award.date) }
    add(source, join(award.title, award.awarder && `from ${award.awarder.trim()}`, source.date), true)
    for (const s of (award.summary ?? '').split(SENTENCE_SPLIT)) add(source, s)
  }

  for (const project of data.projects ?? []) {
    known(project.name, 'title')
    known(project.entity, 'org')
    const source: FactSource = { section: 'project', names: named(project.name, project.entity), start: clean(project.startDate), end: clean(project.endDate) }
    const head = [project.name?.trim(), project.description?.trim()].filter(Boolean).join(': ')
    add(source, join(head, project.entity, range(source.start, source.end)), true)
    for (const h of project.highlights ?? []) add(source, h)
    if (project.keywords?.length) add(source, `Tools: ${project.keywords.join(', ')}`)
  }

  for (const vol of data.volunteer ?? []) {
    const org = clean(vol.organization)
    known(org, 'org')
    const source: FactSource = { section: 'volunteer', names: named(org), title: clean(vol.position), start: clean(vol.startDate), end: clean(vol.endDate) }
    add(source, join([source.title, org].filter(Boolean).join(' at '), range(source.start, source.end)), true)
    for (const s of (vol.summary ?? '').split(SENTENCE_SPLIT)) add(source, s)
    for (const h of vol.highlights ?? []) add(source, h)
  }

  for (const pub of data.publications ?? []) {
    known(pub.name, 'title')
    known(pub.publisher, 'org')
    const source: FactSource = { section: 'publication', names: named(pub.name, pub.publisher), date: clean(pub.releaseDate) }
    add(source, join(pub.name, pub.publisher, source.date), true)
    for (const s of (pub.summary ?? '').split(SENTENCE_SPLIT)) add(source, s)
  }

  for (const skill of data.skills ?? []) {
    const list = (skill.keywords ?? []).join(', ')
    add({ section: 'skills', names: [] }, [skill.name?.trim(), list].filter(Boolean).join(': '))
  }

  for (const lang of data.languages ?? []) {
    add({ section: 'language', names: [] }, [lang.language, lang.fluency && `(${lang.fluency})`].filter(Boolean).join(' '))
  }

  for (const section of data.customSections ?? []) {
    const on = new Set(section.enabledFields)
    for (const item of section.items ?? []) {
      known(item.title, 'title')
      const itemNames = named(item.title)
      const dated = on.has('dateRange')
      const source: FactSource = {
        section: 'custom',
        names: itemNames,
        title: clean(section.name),
        start: dated ? clean(item.startDate) : undefined,
        end: dated ? clean(item.endDate) : undefined,
      }
      const head = [item.title?.trim(), on.has('subtitle') ? item.subtitle?.trim() : undefined].filter(Boolean).join(', ')
      add(source, `${section.name}: ${join(head, range(source.start, source.end))}`, true)
      if (on.has('summary')) for (const s of (item.summary ?? '').split(SENTENCE_SPLIT)) add(source, s)
      if (on.has('highlights')) for (const h of item.highlights ?? []) add(source, h)
      if (on.has('keywords') && item.keywords?.length) add(source, item.keywords.join(', '))
      if (on.has('roles')) {
        for (const role of item.roles ?? []) {
          const rs: FactSource = { ...source, title: clean(role.title) ?? source.title, start: clean(role.startDate), end: clean(role.endDate) }
          add(rs, join(role.title, role.subtitle, range(rs.start, rs.end)), true)
          for (const s of (role.summary ?? '').split(SENTENCE_SPLIT)) add(rs, s)
          for (const h of role.highlights ?? []) add(rs, h)
        }
      }
    }
  }

  return { facts, knownNames: [...names.values()], candidateName: clean(data.basics?.name) }
}

function label(source: FactSource): string {
  if (source.section === 'summary' || source.section === 'skills' || source.section === 'language') return `[${source.section}]`
  const when = source.date ?? range(source.start, source.end)
  const detail = join(source.title, source.names[0], when)
  return detail ? `[${source.section}: ${detail}]` : `[${source.section}]`
}

export function renderFactSheet(sheet: FactSheet): string {
  return sheet.facts.map((f) => `${f.id} ${label(f.source)} ${f.text}`).join('\n')
}

export function factById(sheet: FactSheet, id: string): Fact | undefined {
  return sheet.facts.find((f) => f.id === id)
}
