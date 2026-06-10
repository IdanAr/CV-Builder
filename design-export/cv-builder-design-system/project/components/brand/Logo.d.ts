import type { FC } from 'react'

export interface LogoProps {
  /** Glyph height in px. @default 40 */
  size?: number
  /** Show the gradient wordmark beside the glyph. @default true */
  showWordmark?: boolean
  /** Wordmark text. @default 'CV Builder' */
  wordmark?: string
}

/**
 * CV Builder brand mark — violet hexagon network node + star glyph with an
 * optional indigo→purple gradient wordmark.
 * @startingPoint section="Brand" subtitle="Logo + wordmark" viewport="700x140"
 */
export declare const Logo: FC<LogoProps>
