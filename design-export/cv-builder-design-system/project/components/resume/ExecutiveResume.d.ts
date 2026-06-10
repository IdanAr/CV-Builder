import type { FC } from 'react'
import type { ResumeData, ResumeMeta } from './ClassicResume'

/**
 * @startingPoint section="CV Templates" subtitle="Executive — serif, senior tone" viewport="794x1123"
 */
export interface ExecutiveResumeProps {
  data?: ResumeData
  meta?: ResumeMeta
}

/**
 * Executive CV template — serif, left-aligned, restrained. Large name over a
 * thin double rule with small-caps section titles. A4 (794×1123px).
 */
export declare const ExecutiveResume: FC<ExecutiveResumeProps>
