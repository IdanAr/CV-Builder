import type { FC, ReactNode, CSSProperties } from 'react'

export interface BadgeProps {
  /** @default 'neutral' */
  variant?: 'neutral' | 'matched' | 'missing' | 'info' | 'warn' | 'solid'
  children?: ReactNode
  style?: CSSProperties
}

/**
 * Small pill label — keyword chips (matched/missing in the ATS panel), template
 * tags, and status markers.
 * @startingPoint section="Core" subtitle="Badges & keyword chips" viewport="700x140"
 */
export declare const Badge: FC<BadgeProps>
