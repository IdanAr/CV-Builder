import type { FC } from 'react'

export interface AvatarProps {
  name?: string
  /** Photo URL; falls back to gradient initials when absent. */
  image?: string
  /** Pixel diameter. @default 32 */
  size?: number
}

/**
 * Gradient initials avatar — profile pill and account dropdown.
 * @startingPoint section="Core" subtitle="Avatar" viewport="700x110"
 */
export declare const Avatar: FC<AvatarProps>
