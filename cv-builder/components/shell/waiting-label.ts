/**
 * The spoken form of the sidebar's waiting count, shared by the chip's
 * screen-reader text and the collapsed rail link's accessible name. Empty at
 * zero (no chip, plain name); "99+" above 99, matching the visible chip.
 */
export function waitingLabel(count: number): string {
  if (count <= 0) return ''
  const shown = count > 99 ? '99+' : String(count)
  return `${shown} ${count === 1 ? 'item' : 'items'} waiting`
}
