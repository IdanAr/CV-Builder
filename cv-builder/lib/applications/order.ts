// lib/applications/order.ts
// Fractional-index ordering for drag-and-drop: moving an item computes a new
// `order` at the midpoint of its destination neighbors, so in the common case
// only the moved item's order changes — no full renumbering. Used for both
// table rows (Application.order) and board columns (BoardColumn.order).

const ORDER_GAP = 1000

export interface Orderable {
  id: string
  order: number
}

/**
 * Given items and a dnd drop (active dragged onto over), returns the moved
 * item's new order value, or null for a no-op / unknown ids.
 * Mirrors dnd-kit's arrayMove semantics: the active item takes the over
 * item's visual slot.
 */
export function computeMovedOrder(items: Orderable[], activeId: string, overId: string): number | null {
  if (activeId === overId) return null
  const sorted = [...items].sort((a, b) => a.order - b.order)
  const fromIndex = sorted.findIndex((i) => i.id === activeId)
  const toIndex = sorted.findIndex((i) => i.id === overId)
  if (fromIndex === -1 || toIndex === -1) return null

  // Simulate arrayMove to find the moved item's new neighbors. Whether moving
  // up or down, the removal-then-insert cancels out to the same slot index.
  const without = sorted.filter((i) => i.id !== activeId)
  const before = without[toIndex - 1]
  const after = without[toIndex]

  if (!before && !after) return null
  if (!before) return after.order - ORDER_GAP
  if (!after) return before.order + ORDER_GAP
  return (before.order + after.order) / 2
}
