import type { FC } from 'react'
import type { ResumeData, ResumeMeta } from './ClassicResume'

/**
 * @startingPoint section="CV Templates" subtitle="Sidebar — colored left rail" viewport="794x1123"
 */
export interface SidebarResumeProps {
  data?: ResumeData
  meta?: ResumeMeta
}

/**
 * Sidebar CV template — fixed colored left rail (name, contact, skills,
 * languages) beside a white main column (summary, work, education). Linear DOM
 * order keeps it ATS-readable. A4 (794×1123px).
 */
export declare const SidebarResume: FC<SidebarResumeProps>
