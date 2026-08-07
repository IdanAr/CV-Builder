// components/editor/PreviewEditOverlay.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { getSectionItems, setSectionItems } from '@/lib/editor/section-items'
import type { ResumeData } from '@/lib/schemas/resume.zod'

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface EntryRectEntry extends Rect {
  sectionKey: string
  index: number
}

export interface PreviewEditOverlayProps {
  innerRef: React.RefObject<HTMLDivElement | null>
  wrapperRef: React.RefObject<HTMLDivElement | null>
  scale: number
  sectionOrder: string[]
  data: ResumeData
}

type HandleId =
  | { kind: 'section'; sectionKey: string }
  | { kind: 'entry'; sectionKey: string; index: number }

// `|` is the id-part separator: a custom section's own key (`custom:<uuid>`)
// contains `:`, so `:` can't also be the separator without ambiguity. `|`
// never appears in a built-in key or a crypto.randomUUID() value.
export function parseHandleId(id: string): HandleId | null {
  const parts = id.split('|')
  if (parts[0] === 'section' && parts.length === 2) {
    return { kind: 'section', sectionKey: parts[1] }
  }
  if (parts[0] === 'entry' && parts.length === 3) {
    const index = Number(parts[2])
    if (Number.isNaN(index)) return null
    return { kind: 'entry', sectionKey: parts[1], index }
  }
  return null
}

function useMeasuredRects(
  innerRef: React.RefObject<HTMLDivElement | null>,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  // Re-measure whenever content, order, or zoom could have moved things —
  // the ResizeObserver alone doesn't catch a reorder that keeps total
  // height constant.
  deps: readonly unknown[]
): { sectionRects: Record<string, Rect>; entryRects: EntryRectEntry[] } {
  const [sectionRects, setSectionRects] = useState<Record<string, Rect>>({})
  const [entryRects, setEntryRects] = useState<EntryRectEntry[]>([])

  const measure = useCallback(() => {
    const inner = innerRef.current
    const wrapper = wrapperRef.current
    if (!inner || !wrapper) return
    const wrapperBox = wrapper.getBoundingClientRect()

    const nextSections: Record<string, Rect> = {}
    inner.querySelectorAll<HTMLElement>('[data-pv-section]').forEach((el) => {
      const key = el.dataset.pvSection
      if (!key) return
      const box = el.getBoundingClientRect()
      nextSections[key] = {
        top: box.top - wrapperBox.top,
        left: box.left - wrapperBox.left,
        width: box.width,
        height: box.height,
      }
    })

    const nextEntries: EntryRectEntry[] = []
    inner.querySelectorAll<HTMLElement>('[data-pv-entry]').forEach((el) => {
      const sectionEl = el.closest<HTMLElement>('[data-pv-section]')
      const sectionKey = sectionEl?.dataset.pvSection
      const idxStr = el.dataset.pvEntry
      if (!sectionKey || idxStr === undefined) return
      const box = el.getBoundingClientRect()
      nextEntries.push({
        sectionKey,
        index: Number(idxStr),
        top: box.top - wrapperBox.top,
        left: box.left - wrapperBox.left,
        width: box.width,
        height: box.height,
      })
    })

    setSectionRects(nextSections)
    setEntryRects(nextEntries)
  }, [innerRef, wrapperRef])

  // useEffect instead of useLayoutEffect: this component is a sibling of
  // wrapperRef's div, not an ancestor. React attaches refs during commit in
  // depth-first order, so when this sibling's useLayoutEffect would fire,
  // wrapperRef.current is still null. useEffect defers measurement until after
  // the entire tree's layout phase is complete, ensuring both refs are set.
  // Consequence: there is one frame of stale or zero handle positions after
  // mount and after each sectionOrder/data/scale change. Consumers (Tasks 10-12
  // drag handles, add/remove controls) should not assume positions are
  // instantaneously current during fast sequences of edits.
  useEffect(() => {
    measure()
    const inner = innerRef.current
    if (!inner) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(inner)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps])

  return { sectionRects, entryRects }
}

function DragHandle({
  id, rect, offset, size, label,
}: {
  id: string
  rect: Rect
  offset: number
  size: number
  label: string
}) {
  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({ id })
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id })
  return (
    <button
      ref={(el) => { setDragRef(el); setDropRef(el) }}
      type="button"
      data-testid={`pv-handle-${id}`}
      aria-label={label}
      {...listeners}
      {...attributes}
      style={{
        position: 'absolute',
        top: rect.top,
        left: Math.max(rect.left - offset, 0),
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 4,
        border: 'none',
        background: isOver ? 'rgba(99,102,241,0.28)' : 'rgba(99,102,241,0.14)',
        color: '#4338ca',
        fontSize: Math.min(size, 12),
        lineHeight: 1,
        cursor: 'grab',
        zIndex: 25,
      }}
    >
      ⠿
    </button>
  )
}

export type DragEndResolution =
  | { kind: 'section'; sectionOrder: string[] }
  | { kind: 'entry'; sectionKey: string; items: unknown[] }
  | null

// Pure decision function, deliberately separate from the DndContext wiring
// below: given the two raw dnd-kit ids involved in a drop, what should
// change? Kept side-effect-free (no store calls) so it's directly testable
// without simulating pointer geometry jsdom doesn't provide — the same
// reasoning that already led to `parseHandleId` being a standalone export.
export function resolveDragEnd(
  activeRawId: string,
  overRawId: string,
  sectionOrder: string[],
  data: ResumeData
): DragEndResolution {
  if (activeRawId === overRawId) return null
  const activeParsed = parseHandleId(activeRawId)
  const overParsed = parseHandleId(overRawId)
  if (!activeParsed || !overParsed) return null

  if (activeParsed.kind === 'section' && overParsed.kind === 'section') {
    const oldIndex = sectionOrder.indexOf(activeParsed.sectionKey)
    const newIndex = sectionOrder.indexOf(overParsed.sectionKey)
    if (oldIndex === -1 || newIndex === -1) return null
    return { kind: 'section', sectionOrder: arrayMove(sectionOrder, oldIndex, newIndex) }
  }

  if (activeParsed.kind === 'entry' && overParsed.kind === 'entry' && activeParsed.sectionKey === overParsed.sectionKey) {
    const items = getSectionItems(data, activeParsed.sectionKey)
    const oldIndex = activeParsed.index
    const newIndex = overParsed.index
    if (oldIndex < 0 || oldIndex >= items.length || newIndex < 0 || newIndex >= items.length) return null
    return { kind: 'entry', sectionKey: activeParsed.sectionKey, items: arrayMove(items, oldIndex, newIndex) }
  }

  // A section handle dropped onto an entry handle (or vice versa), or two
  // entries from different sections, are no-ops — reordering is scoped to
  // "sections among themselves" and "entries within their own section",
  // matching how ListFieldManager and the sectionOrder DndContext each
  // already only reorder within their own single list.
  return null
}

export function PreviewEditOverlay({ innerRef, wrapperRef, scale, sectionOrder, data }: PreviewEditOverlayProps) {
  const { sectionRects, entryRects } = useMeasuredRects(innerRef, wrapperRef, [sectionOrder, data, scale])
  const [activeLabel, setActiveLabel] = useState<string | null>(null)

  function handleDragStart(event: DragStartEvent) {
    const parsed = parseHandleId(String(event.active.id))
    if (!parsed) return
    setActiveLabel(parsed.kind === 'section' ? 'Move section' : 'Move entry')
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLabel(null)
    const { active, over } = event
    if (!over) return
    const result = resolveDragEnd(String(active.id), String(over.id), sectionOrder, data)
    if (!result) return
    if (result.kind === 'section') {
      useResumeEditorStore.getState().setMeta({ sectionOrder: result.sectionOrder })
    } else {
      setSectionItems(result.sectionKey, result.items)
    }
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {sectionOrder.map((sectionKey) => {
        const sectionRect = sectionRects[sectionKey]
        if (!sectionRect) return null
        const items = getSectionItems(data, sectionKey)
        return (
          <div key={sectionKey}>
            <DragHandle
              id={`section|${sectionKey}`}
              rect={sectionRect}
              offset={24}
              size={20}
              label="Drag to reorder section"
            />
            {items.map((_, i) => {
              const entryRect = entryRects.find((r) => r.sectionKey === sectionKey && r.index === i)
              if (!entryRect) return null
              return (
                <DragHandle
                  key={i}
                  id={`entry|${sectionKey}|${i}`}
                  rect={entryRect}
                  offset={20}
                  size={16}
                  label={`Drag to reorder entry ${i + 1}`}
                />
              )
            })}
          </div>
        )
      })}
      <DragOverlay>
        {activeLabel ? (
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              background: 'rgba(67,56,202,0.9)',
              color: '#fff',
              fontSize: 12,
              fontFamily: 'sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            ⠿ {activeLabel}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
