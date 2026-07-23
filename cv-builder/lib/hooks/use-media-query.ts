import { useEffect, useState } from 'react'

/**
 * Tracks whether a CSS media query currently matches. Re-evaluates on
 * change (e.g. viewport resize) rather than only on mount, so components
 * can disable JS-driven behavior (drag handlers, layout state) outright
 * below a breakpoint instead of merely hiding it with CSS.
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false

  const [matches, setMatches] = useState<boolean>(getMatches)

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
