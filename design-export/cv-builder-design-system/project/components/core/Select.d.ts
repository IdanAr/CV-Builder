import type { FC, CSSProperties, ChangeEvent } from 'react'

export interface SelectOption { value: string; label: string }

export interface SelectProps {
  value?: string
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  /** Strings or { value, label } pairs. */
  options?: (string | SelectOption)[]
  disabled?: boolean
  style?: CSSProperties
}

/**
 * Native select styled for the Design panel — font & color pickers.
 * @startingPoint section="Core" subtitle="Select dropdown" viewport="700x120"
 */
export declare const Select: FC<SelectProps>
