import type { FC, ReactNode, CSSProperties } from 'react'

export interface GlassCardProps {
  as?: keyof JSX.IntrinsicElements
  /** @default 'lg' */
  elevation?: 'sm' | 'md' | 'lg' | 'xl'
  padding?: number | string
  children?: ReactNode
  style?: CSSProperties
}

/**
 * The signature frosted-glass surface — translucent white fill, backdrop blur,
 * soft indigo shadow. Wraps resume cards, panels, and modals.
 * @startingPoint section="Core" subtitle="Glass card surface" viewport="700x200"
 */
export declare const GlassCard: FC<GlassCardProps>
