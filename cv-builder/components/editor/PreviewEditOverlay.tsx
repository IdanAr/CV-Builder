// components/editor/PreviewEditOverlay.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  DndContext, DragOverlay, closestCenter,
  useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent, type CollisionDetection,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { getSectionItems, setSectionItems } from '@/lib/editor/section-items'
import { EMPTY_ENTRY_FACTORIES } from '@/lib/schemas/resume-empty-entries'
import type { ResumeData, CustomSection } from '@/lib/schemas/resume.zod'

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

// Matches EditTab.tsx's SECTION_LABELS, excluding `basics` (never addable/removable).
const SECTION_LABELS: Record<string, string> = {
  work: 'Work Experience',
  education: 'Education',
  skills: 'Skills',
  languages: 'Languages',
  volunteer: 'Volunteer',
  certificates: 'Certificates',
  awards: 'Awards',
  publications: 'Publications',
  interests: 'Interests',
  projects: 'Projects',
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

// Every handle is both a draggable and a droppable, and section handles sit
// only a section-title's height away from that section's own entry handles —
// the same narrow vertical strip. Unfiltered `closestCenter` therefore often
// picks an entry handle while a section handle is being dragged (or vice
// versa), which lands in `resolveDragEnd`'s mismatched-kind branch and is a
// silent no-op for the user. Restrict candidates to the active handle's own
// kind before delegating to `closestCenter`, so a section drag can only ever
// resolve against another section (and an entry against another entry).
export const sameKindClosestCenter: CollisionDetection = (args) => {
  const activeKind = parseHandleId(String(args.active.id))?.kind
  const filtered = args.droppableContainers.filter(
    (c) => parseHandleId(String(c.id))?.kind === activeKind
  )
  return closestCenter({ ...args, droppableContainers: filtered })
}

// Below this measured height, a fixed-size entry handle would visually
// overlap its neighbors (entries render closer together than a legible
// handle at low zoom) — skip the affordance rather than render a broken
// one. Not needed for section handles: sections are spaced far enough
// apart in practice that this doesn't occur.
const MIN_ENTRY_HANDLE_RECT_HEIGHT = 14

// The widest handle offset in use is 24px (the section handle) — handles
// render that far to the *left* of a section group's own content box (see
// DragHandle's `left: rect.left - offset`, which is allowed to go negative).
// The group's hover-catching box is widened by this much so the handle
// itself is inside the hoverable region, not just the content next to it —
// otherwise moving the mouse onto the handle crosses out of the box that
// keeps it visible, hiding it right as the user reaches for it. A few px of
// slack beyond the exact 24px minimum absorbs fast mouse movement near the
// boundary.
const HANDLE_GUTTER = 32

// Every control fades in/out together rather than each having its own
// per-element hover state — hovering anywhere in a section (its title, any
// entry, the gap between entries) reveals that section's own handle, all of
// its entries' handles, and its "add entry" button as one group. This is a
// deliberate simplification: pixel-precise nested hover regions (entry vs.
// section) are fragile to get right without live visual feedback, and one
// coherent "hover this section to see its controls" region is both simpler
// and a well-understood pattern (comparable to row-hover actions in table/
// list UIs elsewhere).
const CONTROLS_FADE_MS = 120

function controlsVisibilityStyle(visible: boolean): React.CSSProperties {
  return {
    opacity: visible ? 1 : 0,
    pointerEvents: visible ? 'auto' : 'none',
    transition: `opacity ${CONTROLS_FADE_MS}ms ease`,
  }
}

/**
 * Whether the device has a genuinely hover-capable pointer.
 *
 * Every control in this overlay — section and entry drag handles, "+ add entry",
 * "+ Add Section" — was gated on `hovered || dragActive || focused`. A touch
 * device fires no `mouseenter`, and because the hidden state also sets
 * `pointer-events: none`, a tap could neither reveal nor focus the controls:
 * editing from the preview was not merely hard to discover on touch, it was
 * unreachable. That covers the mobile Preview view and iPads in the desktop
 * side-by-side layout. Where there is no hover, the controls stay visible.
 */
function useHasHover(): boolean {
  // Assume hover for SSR and the first client render so server and client
  // markup agree; the effect corrects it on touch devices immediately after.
  const [hasHover, setHasHover] = useState(true)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(hover: hover)')
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasHover(query.matches)
    const onChange = (e: MediaQueryListEvent) => setHasHover(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return hasHover
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
        // `rect` is section-local (0,0 = the section group's own top-left,
        // which itself sits at the section's real page position). Most
        // entries start flush with their section's left edge, so `rect.left`
        // is typically 0 — clamping `rect.left - offset` to a minimum of 0
        // would then always land the handle at local x=0, directly on top of
        // the entry's own text instead of in the real margin to its left.
        // Going negative here is correct: it moves the handle further left,
        // into the page's actual margin/gutter outside the group's own box
        // (nothing in this overlay clips overflow).
        left: rect.left - offset,
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

// One hoverable group per section: a transparent, full-width-of-section
// wrapper that tracks its own hover state and fades its children (section
// handle, entry handles, add-entry button) in/out together. `dragActive`
// overrides hover — while any drag is in progress, every group's controls
// stay visible so the user can see valid drop targets, not just the one
// they happen to be hovering.
function SectionOverlayGroup({
  sectionKey,
  sectionRect,
  entryRects,
  dragActive,
  onAddEntry,
}: {
  sectionKey: string
  sectionRect: Rect
  entryRects: EntryRectEntry[]
  dragActive: boolean
  onAddEntry: (sectionKey: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  // Keyboard-focus equivalent of `hovered`: a keyboard user Tabbing to a
  // handle or the add-entry button never fires mouseenter, so without this
  // the controls stay at opacity 0 while focused — invisible but fully
  // functional (WCAG 2.4.7 Focus Visible violation). React's onFocus/onBlur
  // bubble (unlike native focus/blur), so handlers on this same wrapper
  // mirror onMouseEnter/onMouseLeave for the whole group.
  const [focused, setFocused] = useState(false)
  const hasHover = useHasHover()
  // Without a hover-capable pointer there is no way to reveal these, so they
  // stay visible rather than being permanently hidden and untappable.
  const visible = !hasHover || hovered || dragActive || focused

  const lastEntryRect = entryRects.reduce<EntryRectEntry | null>(
    (last, r) => (!last || r.top > last.top ? r : last),
    null
  )
  // Unlike the entry handles below, the "+" is not omitted when the last
  // entry is too small — adding an entry is the section's only affordance
  // here, and there is no neighbouring "+" for it to collide with. It just
  // anchors off the section box instead, landing in the same place (just
  // under the section's last line) without hugging a sliver-thin entry rect.
  const addAnchor =
    lastEntryRect && lastEntryRect.height >= MIN_ENTRY_HANDLE_RECT_HEIGHT ? lastEntryRect : sectionRect
  const addAnchorLocalTop = (addAnchor.top - sectionRect.top) + addAnchor.height
  const addButtonSize = 18
  const addTop = addAnchorLocalTop + 4
  // Centered horizontally within the section's own width, not hugging the
  // left margin — the "+" is the section's primary hover affordance now
  // that it's revealed on hover rather than always-on, so it reads as
  // belonging to the section itself rather than the next section's title.
  const addLeft = Math.max(sectionRect.width / 2 - addButtonSize / 2, 0)
  const groupHeight = Math.max(sectionRect.height, addTop + addButtonSize + 4)

  return (
    // The hover-catching box must cover everywhere a handle can actually
    // render, not just the section's own content box — handles sit in the
    // page's left margin via a *negative* local `left` (see DragHandle),
    // outside the content box's own bounds. Without this, moving the mouse
    // from the content onto the handle itself crosses out of the hoverable
    // region and hides the very thing being reached for. HANDLE_GUTTER
    // covers the widest offset in use (24px, the section handle) plus a
    // few px of slack; the inner div restores the original local origin
    // (0,0 = the section's true position) so every child's existing
    // `rect.left - offset` math is unaffected by this outer expansion.
    <div
      data-testid={`pv-section-group-${sectionKey}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Only clear focus-visibility when focus is truly leaving the group
        // — e.g. Tabbing from the section handle to its own entry handle or
        // add-entry button (all inside this same wrapper) must not flicker
        // the group invisible for a frame between the blur and the next
        // element's focus.
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setFocused(false)
        }
      }}
      style={{
        position: 'absolute',
        top: sectionRect.top,
        left: sectionRect.left - HANDLE_GUTTER,
        width: sectionRect.width + HANDLE_GUTTER,
        height: groupHeight,
      }}
    >
      <div style={{ ...controlsVisibilityStyle(visible), position: 'absolute', top: 0, left: HANDLE_GUTTER, width: sectionRect.width, height: groupHeight }}>
        <DragHandle
          id={`section|${sectionKey}`}
          rect={{ top: 0, left: 0, width: sectionRect.width, height: sectionRect.height }}
          offset={24}
          size={20}
          label="Drag to reorder section"
        />
        {entryRects.map((entryRect) => {
          // Too visually compressed (low zoom) to carry a fixed-size handle
          // without overlapping its neighbors — omit it.
          if (entryRect.height < MIN_ENTRY_HANDLE_RECT_HEIGHT) return null
          return (
            <DragHandle
              key={entryRect.index}
              id={`entry|${sectionKey}|${entryRect.index}`}
              rect={{
                top: entryRect.top - sectionRect.top,
                left: entryRect.left - sectionRect.left,
                width: entryRect.width,
                height: entryRect.height,
              }}
              offset={20}
              size={16}
              label={`Drag to reorder entry ${entryRect.index + 1}`}
            />
          )
        })}
        <button
          type="button"
          data-testid={`pv-add-entry-${sectionKey}`}
          aria-label={`Add entry to ${SECTION_LABELS[sectionKey] ?? sectionKey}`}
          onClick={() => onAddEntry(sectionKey)}
          style={{
            position: 'absolute',
            top: addTop,
            left: addLeft,
            width: addButtonSize,
            height: addButtonSize,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            border: '1px dashed rgba(99,102,241,0.5)',
            background: 'rgba(99,102,241,0.08)',
            color: '#4338ca',
            fontSize: 12,
            lineHeight: 1,
            cursor: 'pointer',
            zIndex: 25,
          }}
        >
          +
        </button>
      </div>
    </div>
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
  const [addSectionHovered, setAddSectionHovered] = useState(false)
  // Keyboard-focus counterpart to `addSectionHovered` — see the matching
  // `focused` state in SectionOverlayGroup for the full rationale.
  const [addSectionFocused, setAddSectionFocused] = useState(false)
  const hasHover = useHasHover()
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const requestFocus = useResumeEditorStore((s) => s.requestFocus)
  const addCustomSection = useResumeEditorStore((s) => s.addCustomSection)
  const dragActive = activeLabel !== null

  // NOTE on `useResumeEditorStore.getState()` in the mutating handlers below:
  // `data`/`sectionOrder` arrive here from PreviewTab's *debounced* copies
  // (300ms trailing, no maxWait — during a continuous typing burst they stay
  // stale for the whole burst). Rendering off them is correct (handles should
  // track what is actually painted), but a whole-array replacement computed
  // from them would silently discard any newer store state — a double-click
  // on "+", or "+" pressed mid-typing-burst, would drop the first addition or
  // the burst. So every write reads live state at write time instead.
  // `handleAddCustomSection` is exempt: `addCustomSection` uses a Zustand
  // updater function internally and already sees current state.
  function handleAddEntry(sectionKey: string) {
    const items = getSectionItems(useResumeEditorStore.getState().data, sectionKey)
    if (sectionKey.startsWith('custom:')) {
      setSectionItems(sectionKey, [...items, { id: crypto.randomUUID() }])
    } else {
      const factory = EMPTY_ENTRY_FACTORIES[sectionKey]
      if (!factory) return
      setSectionItems(sectionKey, [...items, factory()])
    }
    // The new entry lands at the end — its index is the pre-add length.
    // ListFieldManager (once the accordion opens) scrolls to and focuses it.
    requestFocus(sectionKey, items.length)
  }

  function handleAddCustomSection() {
    const newSection: CustomSection = {
      id: crypto.randomUUID(),
      name: 'New Section',
      enabledFields: ['summary'],
      items: [],
    }
    addCustomSection(newSection)
    requestFocus(`custom:${newSection.id}`)
    setAddMenuOpen(false)
  }

  function handleReAddBuiltIn(sectionKey: string) {
    const liveOrder = useResumeEditorStore.getState().meta.sectionOrder ?? []
    useResumeEditorStore.getState().setMeta({ sectionOrder: [...liveOrder, sectionKey] })
    requestFocus(sectionKey)
    setAddMenuOpen(false)
  }

  const removedBuiltIns = Object.keys(SECTION_LABELS).filter((k) => !sectionOrder.includes(k))

  function handleDragStart(event: DragStartEvent) {
    const parsed = parseHandleId(String(event.active.id))
    if (!parsed) return
    setActiveLabel(parsed.kind === 'section' ? 'Move section' : 'Move entry')
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveLabel(null)
    const { active, over } = event
    if (!over) return
    const live = useResumeEditorStore.getState()
    const result = resolveDragEnd(String(active.id), String(over.id), live.meta.sectionOrder ?? [], live.data)
    if (!result) return
    if (result.kind === 'section') {
      useResumeEditorStore.getState().setMeta({ sectionOrder: result.sectionOrder })
    } else {
      setSectionItems(result.sectionKey, result.items)
    }
  }

  const addSectionVisible = !hasHover || addSectionHovered || addMenuOpen || addSectionFocused

  return (
    <DndContext collisionDetection={sameKindClosestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      {sectionOrder.map((sectionKey) => {
        const sectionRect = sectionRects[sectionKey]
        if (!sectionRect) return null
        const items = getSectionItems(data, sectionKey)
        const sectionEntryRects = entryRects.filter((r) => r.sectionKey === sectionKey && r.index < items.length)
        return (
          <SectionOverlayGroup
            key={sectionKey}
            sectionKey={sectionKey}
            sectionRect={sectionRect}
            entryRects={sectionEntryRects}
            dragActive={dragActive}
            onAddEntry={handleAddEntry}
          />
        )
      })}
      {(() => {
        const lastSectionRect = sectionOrder
          .map((k) => sectionRects[k])
          .filter((r): r is Rect => Boolean(r))
          .reduce<Rect | null>((last, r) => (!last || r.top > last.top ? r : last), null)
        if (!lastSectionRect) return null
        const top = lastSectionRect.top + lastSectionRect.height + 4
        return (
          <div
            onMouseEnter={() => setAddSectionHovered(true)}
            onMouseLeave={() => setAddSectionHovered(false)}
            onFocus={() => setAddSectionFocused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setAddSectionFocused(false)
              }
            }}
            style={{ position: 'absolute', top, left: 0, right: 0, minHeight: 40 }}
          >
            <div style={{ ...controlsVisibilityStyle(addSectionVisible), position: 'relative' }}>
              <button
                type="button"
                data-testid="pv-add-section-toggle"
                aria-haspopup="menu"
                aria-expanded={addMenuOpen}
                onClick={() => setAddMenuOpen((o) => !o)}
                style={{
                  // Mirrors EditTab.tsx's own "+ Add Section" emphasis
                  // (border-2 border-dashed border-indigo-300, font-semibold,
                  // shadow-[0_0_14px_-2px_rgba(99,102,241,0.45)]) so both entry
                  // points for this action read as the same feature. Padding/
                  // font-size stay smaller than EditTab's — this button lives
                  // inside a hover/focus-revealed overlay on top of the scaled
                  // live preview, not a static full-width accordion row.
                  padding: '4px 10px',
                  borderRadius: 8,
                  border: '2px dashed rgba(165,180,252,0.9)',
                  background: 'rgba(238,242,255,0.6)',
                  color: '#6366f1',
                  fontSize: 12,
                  fontWeight: 600,
                  boxShadow: '0 0 14px -2px rgba(99,102,241,0.45)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}
              >
                + Add Section
              </button>
              {addMenuOpen && (
                <div
                  role="menu"
                  style={{
                    marginTop: 4,
                    borderRadius: 8,
                    border: '1px solid rgba(99,102,241,0.2)',
                    background: '#fff',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    overflow: 'hidden',
                    minWidth: 180,
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleAddCustomSection}
                    style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, color: '#312e81', background: 'none', border: 'none', cursor: 'pointer' }}
                  >
                    + New custom section
                  </button>
                  {removedBuiltIns.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="menuitem"
                      onClick={() => handleReAddBuiltIn(k)}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, color: '#312e81', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {SECTION_LABELS[k]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}
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
