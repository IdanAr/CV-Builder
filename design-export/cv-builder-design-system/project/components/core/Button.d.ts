import type { FC, ReactNode, CSSProperties } from 'react'

export interface ButtonProps {
  /** Visual style. @default 'primary' */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  /** @default 'md' */
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
  children?: ReactNode
  style?: CSSProperties
}

/**
 * The CV Builder primary button — indigo fill with outline / ghost / danger
 * variants. Used across the navbar, editor, and dashboard.
 * @startingPoint section="Core" subtitle="Buttons — primary, secondary, ghost, danger" viewport="700x180"
 */
export declare const Button: FC<ButtonProps>
