'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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

function SortableRow({
  id,
  children,
}: {
  id: string
  children: (drag: {
    setNodeRef: (el: HTMLElement | null) => void
    style: React.CSSProperties
    listeners: ReturnType<typeof useSortable>['listeners']
    attributes: ReturnType<typeof useSortable>['attributes']
    isDragging: boolean
  }) => React.ReactNode
}) {
  const { setNodeRef, transform, transition, listeners, attributes, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  return <>{children({ setNodeRef, style, listeners, attributes, isDragging })}</>
}

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

  // Ids are plain indices: @dnd-kit only needs id stability for the
  // duration of a single drag gesture (the `items` array — and therefore
  // this id list — never changes mid-gesture, only on drop), so there's no
  // need for per-item synthetic ids.
  const ids = items.map((_, i) => String(i))

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return
    const oldIndex = Number(active.id)
    const newIndex = Number(over.id)
    if (Number.isNaN(oldIndex) || Number.isNaN(newIndex)) return
    onChange(arrayMove(itemsRef.current, oldIndex, newIndex))
  }

  return (
    <div className="space-y-3">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((item, i) => (
            // React's reconciliation key must track item identity (stable
            // across add/remove so DOM/component state like input focus
            // doesn't get silently reused for a different underlying item)
            // — separate from dnd-kit's `id` below, which is intentionally
            // positional and only needs to stay stable within one drag
            // gesture. Do not conflate these two.
            <SortableRow key={(item as { id?: string }).id ?? i} id={String(i)}>
              {({ setNodeRef, style, listeners, attributes, isDragging }) => (
                <div
                  ref={setNodeRef}
                  style={style}
                  className={`flex items-start gap-1.5 border border-indigo-100 rounded-lg p-3 bg-white/60 backdrop-blur-sm${
                    isDragging ? ' opacity-60 border-dashed border-indigo-400' : ''
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`list-drag-handle-${i}`}
                    aria-label="Drag to reorder"
                    className="shrink-0 py-1 px-0.5 text-indigo-300 hover:text-indigo-500 cursor-grab select-none"
                    {...listeners}
                    {...attributes}
                  >
                    ⠿
                  </button>
                  <div className="flex-1 min-w-0">
                    <ListItem item={item} index={i} update={update} remove={remove} renderItem={renderItem} />
                  </div>
                </div>
              )}
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
      <button type="button" onClick={add}
        className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
        + {addLabel}
      </button>
    </div>
  )
}
