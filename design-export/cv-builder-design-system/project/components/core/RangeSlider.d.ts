import type { FC } from 'react'

export interface RangeSliderProps {
  label?: string
  value: number
  min?: number
  max?: number
  step?: number
  /** Suffix shown after the value, e.g. '"' or 'pt'. */
  unit?: string
  onChange?: (v: number) => void
  minLabel?: string
  maxLabel?: string
}

/**
 * Labelled range control from the Design panel (page margins, line spacing).
 * @startingPoint section="Core" subtitle="Range slider" viewport="700x130"
 */
export declare const RangeSlider: FC<RangeSliderProps>
