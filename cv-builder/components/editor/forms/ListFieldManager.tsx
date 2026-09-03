'use client'

import React, { useCallback, useEffect, useId, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { toast } from '@/lib/stores/toast.store'

interface ListFieldManagerProps<T> {
  items: T[]
  onChange: (items: T[]) => void
  createEmpty: () => T
  renderItem: (item: T, index: number, onUpdate: (v: T) => void, onRemove: () => void) => React.ReactNode
  addLabel?: string
  // This section's key (e.g. 'work', 'custom:<uuid>') — when a "+" clicked on
  // the Live Preview appends an entry, it calls requestFocus(sectionKey,
  // newIndex). EditTab opens/scrolls to the section but deliberately leaves
  // that request in the store; this component, once mounted inside the now-
  // open accordion, is what actually scrolls to and focuses that specific
  // entry, then clears the request. Omit this prop to opt out (no entry-level
  // scroll — the section-level scroll from EditTab still happens either way).
  sectionKey?: string
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

// Mirrors DesignPanel's/ApplicationsBoard's screenReaderInstructions/
// announcements pattern so a keyboard-only user reordering list entries
// (work roles, bullet points, skills, etc.) gets the same spoken feedback a
// mouse/touch user gets visually.
const listScreenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder an entry: press space or enter to pick it up, use the arrow keys to move it up or down in the list, then press space or enter again to drop it. Press escape to cancel.',
}

// Ids in this component are plain positional indices (see the `ids` comment
// below), so position-based announcements are all that's generically
// available across every ListFieldManager<T> instance — unlike
// DesignPanel/ApplicationsBoard, T's shape isn't known here, so there's no
// generic way to announce a human-readable label for the item itself.
function buildListAnnouncements(itemCount: number): Announcements {
  function describePosition(id: string): string {
    const index = Number(id)
    return Number.isNaN(index) ? '' : `position ${index + 1} of ${itemCount}`
  }
  return {
    onDragStart({ active }) {
      return `Picked up entry at ${describePosition(String(active.id))}.`
    },
    onDragOver({ active, over }) {
      void active
      return over
        ? `Entry is over ${describePosition(String(over.id))}.`
        : 'Entry is no longer over a droppable area.'
    },
    onDragEnd({ active, over }) {
      void active
      return over
        ? `Entry was moved to ${describePosition(String(over.id))}.`
        : 'Entry was dropped.'
    },
    onDragCancel() {
      return 'Reordering was cancelled.'
    },
  }
}

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
  items, onChange, createEmpty, renderItem, addLabel = 'Add entry', sectionKey,
}: ListFieldManagerProps<T>) {
  // Keeps add/remove/update stable across renders (they'd otherwise be
  // recreated every time `items` changes — i.e. on every keystroke — which
  // would break the ListItem memoization below for every sibling item, not
  // just the one being edited.
  // Namespaces this instance's drag-handle testids so nested instances
  // (e.g. WorkForm: work entries -> roles -> highlights, each its own
  // ListFieldManager) never collide on a bare positional index.
  const instanceId = useId()

  // PointerSensor alone drops keyboard support entirely — a keyboard-only
  // user could not reorder entries at all. KeyboardSensor restores it,
  // mirroring DesignPanel.tsx's/ApplicationsBoard.tsx's setup.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const itemsRef = useRef(items)
  // Ref writes must happen outside render (React Compiler safety rule); the
  // callbacks below only ever run from user events, which are always after
  // this effect has committed, so `itemsRef.current` is never stale when read.
  useEffect(() => {
    itemsRef.current = items
  })

  const pendingFocus = useResumeEditorStore((s) => s.pendingFocus)
  const pendingFocusEntryIndex = useResumeEditorStore((s) => s.pendingFocusEntryIndex)
  const clearFocus = useResumeEditorStore((s) => s.clearFocus)
  const itemRefs = useRef<Record<number, HTMLElement | null>>({})

  useEffect(() => {
    if (!sectionKey || pendingFocus !== sectionKey || pendingFocusEntryIndex === null) return
    const el = itemRefs.current[pendingFocusEntryIndex]
    if (!el) return
    // Wait a frame for the row itself to have settled (it was likely just
    // added this same render pass) before measuring/scrolling to it.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.querySelector<HTMLElement>('input, textarea')?.focus()
    })
    clearFocus()
  }, [sectionKey, pendingFocus, pendingFocusEntryIndex, clearFocus])

  const add = useCallback(() => onChange([...itemsRef.current, createEmpty()]), [onChange, createEmpty])
  // A single click here used to destroy a whole entry — a job with its dates
  // and every bullet point — with no confirmation, no undo and no grace period,
  // from a button sitting a few pixels from the drag handle. Rather than gate
  // every removal behind a modal, the delete stays instant and is made
  // reversible with the same undo-toast pattern ResumeCard already uses for
  // résumé deletion.
  const remove = useCallback(
    (i: number) => {
      const removed = itemsRef.current[i]
      onChange(itemsRef.current.filter((_, idx) => idx !== i))
      if (removed === undefined) return
      toast.withAction('Entry removed', 'Undo', () => {
        // Re-insert against the *live* array rather than a snapshot taken at
        // delete time, so edits made elsewhere while the toast was up are not
        // discarded. The index is clamped in case the list shrank since.
        const current = itemsRef.current
        const at = Math.min(i, current.length)
        onChange([...current.slice(0, at), removed, ...current.slice(at)])
      })
    },
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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: buildListAnnouncements(items.length),
          screenReaderInstructions: listScreenReaderInstructions,
        }}
      >
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
                  ref={(el) => { setNodeRef(el); itemRefs.current[i] = el }}
                  style={style}
                  className={`flex items-start gap-1.5 border border-indigo-100 rounded-lg p-3 bg-white/60 backdrop-blur-sm${
                    isDragging ? ' opacity-60 border-dashed border-indigo-400' : ''
                  }`}
                >
                  <button
                    type="button"
                    data-testid={`list-drag-handle-${instanceId}-${i}`}
                    aria-label="Drag to reorder"
                    className="shrink-0 py-1 px-0.5 text-fg-subtle hover:text-fg-body cursor-grab select-none"
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
