// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { useMediaQuery } from '../use-media-query'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

type Listener = (e: { matches: boolean }) => void

/** A matchMedia stub whose match state can be flipped from the test. */
function stubMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>()
  let matches = initial
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      media: query,
      get matches() {
        return matches
      },
      addEventListener: (_: string, fn: Listener) => listeners.add(fn),
      removeEventListener: (_: string, fn: Listener) => listeners.delete(fn),
      addListener: (fn: Listener) => listeners.add(fn),
      removeListener: (fn: Listener) => listeners.delete(fn),
    }))
  )
  return {
    change(next: boolean) {
      matches = next
      act(() => listeners.forEach((fn) => fn({ matches: next })))
    },
    listenerCount: () => listeners.size,
  }
}

function Probe() {
  const isMobile = useMediaQuery('(max-width: 767px)')
  return <span data-testid="probe">{String(isMobile)}</span>
}

describe('useMediaQuery', () => {
  // The regression this guards. Seeding state from matchMedia during the
  // initial render made the server render "false" while the client's first
  // (hydration) pass rendered "true" — React threw a hydration mismatch and
  // discarded the tree. In EditorShell the two branches are entirely different
  // layouts, so the whole shell was rebuilt on every narrow-viewport load.
  //
  // renderToString runs effects not at all, which is exactly the server's
  // view: it must say false even though matchMedia would answer true, because
  // that is what the client's hydration pass has to reproduce.
  it('renders false on the server even when the query matches', () => {
    stubMatchMedia(true)
    expect(renderToString(<Probe />)).toContain('false')
  })

  it('publishes the real value once mounted', () => {
    stubMatchMedia(true)
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('true')
  })

  it('reports false when the query does not match', () => {
    stubMatchMedia(false)
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
  })

  it('follows later viewport changes', () => {
    const mm = stubMatchMedia(false)
    render(<Probe />)
    expect(screen.getByTestId('probe')).toHaveTextContent('false')

    mm.change(true)
    expect(screen.getByTestId('probe')).toHaveTextContent('true')
  })

  it('detaches its listener on unmount', () => {
    const mm = stubMatchMedia(false)
    const { unmount } = render(<Probe />)
    expect(mm.listenerCount()).toBe(1)
    unmount()
    expect(mm.listenerCount()).toBe(0)
  })

  it('survives an environment with no matchMedia at all', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => render(<Probe />)).not.toThrow()
    expect(screen.getByTestId('probe')).toHaveTextContent('false')
  })
})
