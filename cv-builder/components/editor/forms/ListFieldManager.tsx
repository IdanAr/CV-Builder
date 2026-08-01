'use client'

import React, { useCallback, useEffect, useRef } from 'react'

interface ListFieldManagerProps<T> {
  items: T[]
  onChange: (items: T[]) => void
  createEmpty: () => T
  renderItem: (item: T, index: number, onUpdate: (v: T) => void, onRemove: () => void) => React.ReactNode
  addLabel?: string
}

interface ListItemProps<T> {
  item: T
  index: number
  update: (index: number, value: T) => void
  remove: (index: number) => void
  renderItem: ListFieldManagerProps<T>['renderItem']
}

function ListItemInner<T>({ item, index, update, remove, renderItem }: ListItemProps<T>) {
  const onUpdate = useCallback((v: T) => update(index, v), [update, index])
  const onRemove = useCallback(() => remove(index), [remove, index])
  return renderItem(item, index, onUpdate, onRemove)
}

// `renderItem` is deliberately excluded from the comparison: every caller
// passes a pure `(item, index, onUpdate, onRemove) => <ItemForm .../>`
// closure with no per-render-changing captured state, so a new function
// identity for it doesn't mean the output would differ — it's recreated on
// every parent render regardless of which item actually changed, and
// comparing it would defeat the point of memoizing sibling list items.
function listItemPropsAreEqual<T>(prev: ListItemProps<T>, next: ListItemProps<T>): boolean {
  return (
    prev.item === next.item &&
    prev.index === next.index &&
    prev.update === next.update &&
    prev.remove === next.remove
  )
}

const ListItem = React.memo(ListItemInner, listItemPropsAreEqual) as typeof ListItemInner

export function ListFieldManager<T>({
  items, onChange, createEmpty, renderItem, addLabel = 'Add entry',
}: ListFieldManagerProps<T>) {
  // Keeps add/remove/update stable across renders (they'd otherwise be
  // recreated every time `items` changes — i.e. on every keystroke — which
  // would break the ListItem memoization below for every sibling item, not
  // just the one being edited.
  const itemsRef = useRef(items)
  // Ref writes must happen outside render (React Compiler safety rule); the
  // callbacks below only ever run from user events, which are always after
  // this effect has committed, so `itemsRef.current` is never stale when read.
  useEffect(() => {
    itemsRef.current = items
  })

  const add = useCallback(() => onChange([...itemsRef.current, createEmpty()]), [onChange, createEmpty])
  const remove = useCallback(
    (i: number) => onChange(itemsRef.current.filter((_, idx) => idx !== i)),
    [onChange]
  )
  const update = useCallback(
    (i: number, v: T) => onChange(itemsRef.current.map((item, idx) => (idx === i ? v : item))),
    [onChange]
  )

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={(item as {id?: string}).id ?? i} className="border border-indigo-100 rounded-lg p-3 bg-white/60 backdrop-blur-sm">
          <ListItem item={item} index={i} update={update} remove={remove} renderItem={renderItem} />
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
        + {addLabel}
      </button>
    </div>
  )
}
