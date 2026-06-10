import type { FC, CSSProperties, ChangeEvent } from 'react'

export interface InputProps {
  value?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  placeholder?: string
  type?: string
  disabled?: boolean
  /** Render the value in the mono (Geist Mono) face — e.g. hex fields. */
  mono?: boolean
  style?: CSSProperties
}

/**
 * Text input matching the editor forms — translucent white fill, indigo focus
 * ring.
 * @startingPoint section="Core" subtitle="Text input" viewport="700x120"
 */
export declare const Input: FC<InputProps>
