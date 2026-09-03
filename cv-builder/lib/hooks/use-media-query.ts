import { useEffect, useState } from 'react'

/**
 * Tracks whether a CSS media query currently matches. Re-evaluates on
 * change (e.g. viewport resize) rather than only on mount, so components
 * can disable JS-driven behavior (drag handlers, layout state) outright
 * below a breakpoint instead of merely hiding it with CSS.
 */
export function useMediaQuery(query: string): boolean {
  // Always starts false, even though the real answer is available on the
  // client, because the *first* client render is the hydration render and it
  // has to reproduce what the server produced. Seeding from matchMedia looked
  // like a free head start, but it meant the server said "not mobile" while
  // the client's first pass said "mobile" — React then threw a hydration
  // mismatch and rebuilt the tree. In the editor that is not cosmetic: the two
  // branches are entirely different layouts, so the whole shell was discarded
  // and re-rendered on every narrow-viewport load.
  //
  // The effect below publishes the true value immediately after mount, which
  // costs one frame of the desktop layout and is the accepted trade for a tree
  // that actually hydrates.
  const [matches, setMatches] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mql = window.matchMedia(query)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMatches(mql.matches)

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches)

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', handler)
      return () => mql.removeEventListener('change', handler)
    }
    // Safari < 14 fallback
    mql.addListener(handler)
    return () => mql.removeListener(handler)
  }, [query])

  return matches
}
