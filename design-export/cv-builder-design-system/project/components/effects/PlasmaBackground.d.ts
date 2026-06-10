import type { FC, ReactNode, CSSProperties } from 'react'

export interface PlasmaBackgroundProps {
  /** Plasma tint (hex). @default '#4f46e5' */
  color?: string
  /** Flow speed. @default 0.5 */
  speed?: number
  /** Zoom of the field. @default 1.2 */
  scale?: number
  /** Plasma alpha over the page. @default 0.5 */
  opacity?: number
  /** @default 'forward' */
  direction?: 'forward' | 'reverse' | 'pingpong'
  /** Parallax the field toward the cursor. @default true */
  mouseInteractive?: boolean
  /** Lay a soft white wash over the plasma (as on sign-in). @default true */
  overlay?: boolean
  children?: ReactNode
  style?: CSSProperties
}

/**
 * Animated WebGL plasma backdrop — the brand's sign-in / hero background.
 * Renders an indigo plasma (via OGL, dynamically imported at runtime) under a
 * soft white wash, with content composited on top. Fill a positioned, sized
 * parent.
 */
export declare const PlasmaBackground: FC<PlasmaBackgroundProps>
