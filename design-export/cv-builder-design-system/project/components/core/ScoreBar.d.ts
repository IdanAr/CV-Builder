import type { FC } from 'react'

export interface ScoreBarProps {
  value: number
  /** @default 100 */
  max?: number
  label?: string
  /** Show the `value / max` readout. @default true */
  showValue?: boolean
}

/**
 * ATS score bar — fills green/yellow/red against 70/40 thresholds. Used in the
 * ATS breakdown and dashboard format score.
 * @startingPoint section="Core" subtitle="ATS score bar" viewport="700x130"
 */
export declare const ScoreBar: FC<ScoreBarProps>
