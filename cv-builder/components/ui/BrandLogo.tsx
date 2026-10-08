import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * The CVitae Studio logo, served from `public/brand/`.
 *
 * `horizontal` is the wordmark lockup (24-48px tall per the logo kit);
 * `mark` is the symbol alone, for places too narrow for the lockup. Both are
 * the light-background SVGs: the app has no dark theme.
 *
 * Size is set by height on `className` (`h-8`); `w-auto` keeps the aspect
 * ratio. The explicit width/height props below are only the intrinsic ratio
 * that stops layout shift. SVGs are served as-is, so `next/image` does no
 * optimisation here.
 *
 * Pass `alt=""` when the logo sits inside a link or heading that already
 * carries the name.
 */
const VARIANTS = {
  horizontal: { src: '/brand/cvitae-studio-horizontal-light.svg', width: 232, height: 40 },
  mark: { src: '/brand/cvitae-mark-light.svg', width: 64, height: 64 },
} as const

interface BrandLogoProps {
  variant?: keyof typeof VARIANTS
  className?: string
  alt?: string
  priority?: boolean
}

export function BrandLogo({ variant = 'horizontal', className, alt = 'CVitae Studio', priority }: BrandLogoProps) {
  const { src, width, height } = VARIANTS[variant]
  return <Image src={src} width={width} height={height} alt={alt} priority={priority} className={cn('w-auto', className)} />
}
