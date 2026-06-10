import type { FC } from 'react'
import type { ResumeData, ResumeMeta } from './ClassicResume'

/**
 * @startingPoint section="CV Templates" subtitle="Minimal — typography only, max ATS" viewport="794x1123"
 */
export interface MinimalResumeProps {
  data?: ResumeData
  meta?: ResumeMeta
}

/**
 * Minimal CV template — typography only, no rules or color. Centered name with
 * small uppercase grey labels. Maximum ATS compatibility. A4 (794×1123px).
 */
export declare const MinimalResume: FC<MinimalResumeProps>
