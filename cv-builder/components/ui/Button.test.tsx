// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button, buttonClasses, type ButtonSize, type ButtonVariant } from './Button'

afterEach(cleanup)

const VARIANTS: ButtonVariant[] = [
  'primary', 'secondary', 'soft', 'ghost', 'danger', 'dangerGhost', 'link',
]
const SIZES: ButtonSize[] = ['xs', 'sm', 'md', 'icon']

describe('Button', () => {
  it('renders its label as a real button', () => {
    render(<Button>Generate</Button>)
    expect(screen.getByRole('button', { name: 'Generate' })).toBeTruthy()
  })

  it('calls onClick', async () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Export</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Export' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  // Most of these buttons live inside a form but are not its submit action.
  // An unmarked <button> defaults to type="submit" and will submit the form on
  // Enter, which is how a "Remove entry" button ends up saving a résumé.
  it('defaults to type="button" so it cannot accidentally submit a form', () => {
    render(<Button>Remove</Button>)
    expect(screen.getByRole('button', { name: 'Remove' }).getAttribute('type')).toBe('button')
  })

  it('still allows an explicit submit button', () => {
    render(<Button type="submit">Save</Button>)
    expect(screen.getByRole('button', { name: 'Save' }).getAttribute('type')).toBe('submit')
  })

  it('does not fire while disabled', async () => {
    const onClick = vi.fn()
    render(<Button disabled onClick={onClick}>Save</Button>)
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('forwards a ref, so callers can focus it', () => {
    const ref = { current: null as HTMLButtonElement | null }
    render(<Button ref={ref}>Focus me</Button>)
    ref.current?.focus()
    expect(document.activeElement).toBe(ref.current)
  })

  it('passes arbitrary props through, including ARIA', () => {
    render(<Button aria-expanded="true" data-testid="menu-trigger">Menu</Button>)
    expect(screen.getByTestId('menu-trigger').getAttribute('aria-expanded')).toBe('true')
  })

  it('merges a caller className rather than dropping it', () => {
    render(<Button className="w-full">Wide</Button>)
    expect(screen.getByRole('button', { name: 'Wide' }).className).toContain('w-full')
  })

  // twMerge, not string concatenation: a caller overriding a variant's own
  // utility should win, otherwise the two fight and the winner is whichever
  // Tailwind emitted last.
  it('lets a caller override a variant utility instead of colliding with it', () => {
    // Split into class tokens rather than substring-matching: `bg-primary`
    // occurs inside `hover:bg-primary-hover`, which should survive.
    const classes = buttonClasses({ variant: 'primary', className: 'bg-surface' }).split(/\s+/)
    expect(classes).toContain('bg-surface')
    expect(classes).not.toContain('bg-primary')
    expect(classes).toContain('hover:bg-primary-hover')
  })
})

describe('buttonClasses', () => {
  it('defaults to the primary variant at sm', () => {
    const classes = buttonClasses()
    expect(classes).toContain('bg-primary')
    expect(classes).toContain('px-3')
  })

  it.each(VARIANTS)('%s is a distinct, non-empty variant', (variant) => {
    const classes = buttonClasses({ variant })
    expect(classes.length).toBeGreaterThan(0)
    const others = VARIANTS.filter((v) => v !== variant).map((v) => buttonClasses({ variant: v }))
    expect(others).not.toContain(classes)
  })

  // WCAG 2.2 SC 2.5.8 sets a 24x24 CSS pixel floor for pointer targets. The
  // audit found 14 buttons under it; `xs` padding alone lands at 22px, so the
  // floor has to be stated explicitly rather than left to padding.
  it.each(SIZES)('%s states a height floor of at least 24px', (size) => {
    expect(buttonClasses({ size })).toMatch(/\b(min-h-6|min-h-8|min-h-10|h-8)\b/)
  })

  // A ring that only appears on `focus` sticks around after a mouse click;
  // `focus-visible` is what limits it to keyboard traversal.
  it('rings on focus-visible only, at the token ring colour', () => {
    const classes = buttonClasses()
    expect(classes).toContain('focus-visible:ring-2')
    expect(classes).toContain('focus-visible:ring-ring')
    expect(classes).not.toMatch(/(^|\s)focus:ring-/)
  })

  it('keeps a disabled button readable rather than fading it out', () => {
    // opacity-50 on an already-muted foreground is what pushed several of
    // these under 3:1; 60% is the floor that keeps them legible.
    expect(buttonClasses()).toContain('disabled:opacity-60')
  })
})
