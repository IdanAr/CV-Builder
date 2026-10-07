export interface PendingFocus {
  removed: string
  fallbacks: string[]
}

export type FocusPlan =
  | { kind: 'wait' }
  | { kind: 'row'; id: string }
  | { kind: 'list' }

/**
 * Where focus goes once a dismissed or deleted row has left the list.
 * Waits while the row is still listed, and while a job is selected: below `lg`
 * the list is display:none then, and focusing a hidden element is a no-op.
 */
export function planFocusAfterRemoval(
  pending: PendingFocus,
  itemIds: readonly string[],
  jobSelected: boolean
): FocusPlan {
  if (itemIds.includes(pending.removed) || jobSelected) return { kind: 'wait' }
  const id = pending.fallbacks.find((f) => itemIds.includes(f))
  return id ? { kind: 'row', id } : { kind: 'list' }
}
