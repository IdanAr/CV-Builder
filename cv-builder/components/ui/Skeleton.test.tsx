// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Skeleton, SkeletonText } from './Skeleton'

afterEach(cleanup)

describe('Skeleton', () => {
  // The bar is decoration standing in for content that has not arrived. A
  // screen reader announcing a dozen of them says nothing useful; the route's
  // loading state is announced once, by the container.
  it('is hidden from assistive technology', () => {
    const { container } = render(<Skeleton />)
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })

  // `motion-safe:` rather than an unconditional `animate-pulse`: a pulsing
  // page is exactly what prefers-reduced-motion is asking us not to do, and
  // these render inside Server Components where the framer-motion hook the
  // rest of the app uses is unavailable.
  it('only animates when the viewer has not asked for reduced motion', () => {
    const { container } = render(<Skeleton />)
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('motion-safe:animate-pulse')
    expect(classes).not.toContain('animate-pulse')
  })

  it('takes a caller size', () => {
    const { container } = render(<Skeleton className="h-8 w-32" />)
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('h-8')
    expect(classes).toContain('w-32')
  })
})

describe('SkeletonText', () => {
  it('renders three bars by default', () => {
    const { container } = render(<SkeletonText />)
    expect((container.firstChild as HTMLElement).children).toHaveLength(3)
  })

  it('renders the requested number of bars', () => {
    const { container } = render(<SkeletonText lines={5} />)
    expect((container.firstChild as HTMLElement).children).toHaveLength(5)
  })

  // A stack of equal-width bars reads as a table. The short last line is what
  // makes it read as a paragraph.
  it('shortens the last line so the block reads as prose', () => {
    const { container } = render(<SkeletonText lines={3} />)
    const bars = [...(container.firstChild as HTMLElement).children] as HTMLElement[]
    expect(bars.slice(0, -1).every((b) => b.className.includes('w-full'))).toBe(true)
    expect(bars.at(-1)!.className).toContain('w-2/3')
  })

  it('leaves a single line full width, having nothing to contrast against', () => {
    const { container } = render(<SkeletonText lines={1} />)
    const only = (container.firstChild as HTMLElement).firstChild as HTMLElement
    expect(only.className).toContain('w-full')
  })

  it('hides every bar from assistive technology', () => {
    const { container } = render(<SkeletonText lines={4} />)
    const bars = [...(container.firstChild as HTMLElement).children] as HTMLElement[]
    expect(bars.every((b) => b.getAttribute('aria-hidden') === 'true')).toBe(true)
  })
})
