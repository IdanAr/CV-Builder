import type { FC } from 'react'

/**
 * @startingPoint section="CV Templates" subtitle="Classic — clean, accent dividers" viewport="794x1123"
 */
export interface ClassicResumeProps {
  data?: ResumeData
  meta?: ResumeMeta
}

/**
 * Classic CV template — the builder's default. Centered header, thin accent
 * dividers under each section title. Renders at A4 (794×1123px).
 */
export declare const ClassicResume: FC<ClassicResumeProps>

/** JSON-Resume style data consumed by every CV template. */
export interface ResumeData {
  basics?: {
    name?: string
    label?: string
    email?: string
    phone?: string
    url?: string
    summary?: string
    location?: { city?: string; region?: string; countryCode?: string }
    profiles?: { network?: string; username?: string; url?: string }[]
  }
  work?: { name?: string; position?: string; startDate?: string; endDate?: string; summary?: string; highlights?: string[] }[]
  education?: { institution?: string; area?: string; studyType?: string; startDate?: string; endDate?: string; score?: string }[]
  skills?: { name?: string; level?: string; keywords?: string[] }[]
  volunteer?: { organization?: string; position?: string; startDate?: string; endDate?: string; summary?: string; highlights?: string[] }[]
  languages?: { language?: string; fluency?: string }[]
}

/** Design metadata — typography, color, spacing & layout knobs. */
export interface ResumeMeta {
  fontFamily?: string
  headerFontFamily?: string
  /** Primary color — headings, header block, dividers. */
  primaryColor?: string
  /** Accent color — role titles, links. */
  accentColor?: string
  /** Page margin in inches (0.5–1.5). */
  pageMargins?: number
  /** Line height (1.0–1.15). */
  lineSpacing?: number
  /** Order sections render in. */
  sectionOrder?: string[]
  layout?: 'single-column' | 'two-column'
  columnAssignment?: Record<string, 'left' | 'right'>
}
