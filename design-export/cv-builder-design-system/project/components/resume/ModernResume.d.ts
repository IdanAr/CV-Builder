import type { FC } from 'react'
import type { ResumeData, ResumeMeta } from './ClassicResume'

/**
 * @startingPoint section="CV Templates" subtitle="Modern — colored header banner" viewport="794x1123"
 */
export interface ModernResumeProps {
  data?: ResumeData
  meta?: ResumeMeta
}

/**
 * Modern CV template — bold full-width colored header block with white text and
 * uppercase letter-spaced accent section titles. Renders at A4 (794×1123px).
 */
export declare const ModernResume: FC<ModernResumeProps>
