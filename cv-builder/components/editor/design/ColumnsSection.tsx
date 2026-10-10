'use client'

import React from 'react'
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
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useShallow } from 'zustand/react/shallow'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
import { GripVertical } from 'lucide-react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const labelClass = 'block text-xs font-medium text-fg-muted mb-1'

/** Short summary for the collapsed Design section. */
export function layoutSummary(meta: Pick<ResumeMeta, 'templateId' | 'layout' | 'sidebarRailWidth'>): string {
  if (meta.templateId === 'sidebar') return `Rail + main column · ${meta.sidebarRailWidth ?? 33}% rail`
  if (meta.templateId === 'minimal' || meta.layout !== 'two-column') return 'Single column'
  return 'Two columns'
}

const SECTION_LABELS: Record<string, string> = {
  work: 'Work',
  education: 'Education',
  skills: 'Skills',
  volunteer: 'Volunteer',
  languages: 'Languages',
}

function getSectionLabel(sectionKey: string, customSections: ResumeData['customSections']): string {
  if (!sectionKey.startsWith('custom:')) {
    return SECTION_LABELS[sectionKey] ?? sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)
  }
  const id = sectionKey.slice('custom:'.length)
  const cs = customSections?.find((s) => s.id === id)
  return cs?.name ?? sectionKey
}

// Mirrors ApplicationsBoard's screenReaderInstructions/announcements pattern
// so a keyboard-only user reordering sections gets the same spoken feedback
// a mouse/touch user gets visually — required for the KeyboardSensor to be a
// real fallback, not just a technically-present sensor.
const sectionScreenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'To reorder a section: press space or enter to pick it up, use the arrow keys to move it up or down in the list, then press space or enter again to drop it. Press escape to cancel.',
}

function buildSectionAnnouncements(sectionOrder: string[], customSections: ResumeData['customSections']): Announcements {
  function describePosition(sectionKey: string): string {
    const index = sectionOrder.indexOf(sectionKey)
    return index === -1 ? '' : `position ${index + 1} of ${sectionOrder.length}`
  }

  return {
    onDragStart({ active }) {
      return `Picked up ${getSectionLabel(String(active.id), customSections)} at ${describePosition(String(active.id))}.`
    },
    onDragOver({ active, over }) {
      const label = getSectionLabel(String(active.id), customSections)
      return over
        ? `${label} is over ${describePosition(String(over.id))}.`
        : `${label} is no longer over a droppable area.`
    },
    onDragEnd({ active, over }) {
      const label = getSectionLabel(String(active.id), customSections)
      return over
        ? `${label} was moved to ${describePosition(String(over.id))}.`
        : `${label} was dropped.`
    },
    onDragCancel({ active }) {
      return `Moving ${getSectionLabel(String(active.id), customSections)} was cancelled.`
    },
  }
}

interface SortableColumnRowProps {
  sectionKey: string
  label: string
  side: 'left' | 'right'
  onToggle: () => void
}

function SortableColumnRow({ sectionKey, label, side, onToggle }: SortableColumnRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sectionKey,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2.5 py-1.5 border-b border-border last:border-b-0 transition-colors hover:bg-surface-subtle${isDragging ? ' shadow-popover' : ''}`}
    >
      <span
        {...attributes}
        {...listeners}
        className="flex rounded-chip text-fg-subtle cursor-grab active:cursor-grabbing select-none outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10 max-sm:min-w-10 max-sm:items-center max-sm:justify-center"
        aria-label="Drag to reorder"
      >
        <GripVertical aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="flex-1 text-sm text-fg-body">{label}</span>

      <div className="flex rounded-control border border-border bg-surface-subtle p-0.5 text-xs font-medium" role="group" aria-label={`Column for ${label}`}>
        <button
          type="button"
          aria-pressed={side === 'left'}
          onClick={side === 'left' ? undefined : onToggle}
          className={`px-3 py-1 rounded-chip transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10 ${
            side === 'left'
              ? 'bg-surface border border-border text-fg-heading'
              : 'text-fg-muted hover:text-fg-body hover:bg-surface'
          }`}
        >
          Left
        </button>
        <button
          type="button"
          aria-pressed={side === 'right'}
          onClick={side === 'right' ? undefined : onToggle}
          className={`px-3 py-1 rounded-chip transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10 ${
            side === 'right'
              ? 'bg-surface border border-border text-fg-heading'
              : 'text-fg-muted hover:text-fg-body hover:bg-surface'
          }`}
        >
          Right
        </button>
      </div>
    </div>
  )
}

export function ColumnsSection() {
  const meta = useResumeEditorStore((s) => s.meta)
  const customSections = useResumeEditorStore(useShallow((s) => s.data.customSections))
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  // PointerSensor alone dropped keyboard support entirely — a keyboard-only
  // user could not reorder sections at all, with no up/down button fallback.
  // KeyboardSensor restores it, mirroring ApplicationsBoard.tsx's setup.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Sidebar always renders skills/languages in the rail regardless of any
  // stored columnAssignment default, so the assignment editor must consult
  // the same per-template defaults the live preview uses — otherwise it
  // shows the wrong side for sections the user hasn't explicitly assigned.
  const colDefaults = meta.templateId === 'sidebar' ? SIDEBAR_COLUMN_DEFAULTS : undefined

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = meta.sectionOrder.indexOf(active.id as string)
    const newIndex = meta.sectionOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    setMeta({ sectionOrder: arrayMove(meta.sectionOrder, oldIndex, newIndex) })
  }

  function handleColumnToggle(sectionKey: string) {
    const current = getColumnSide(sectionKey, meta.columnAssignment ?? {}, colDefaults)
    const next: 'left' | 'right' = current === 'left' ? 'right' : 'left'
    setMeta({ columnAssignment: { ...meta.columnAssignment, [sectionKey]: next } })
  }
  return (
    <div className="space-y-4">
      {/* Layout toggle — Minimal is single-column only; Sidebar always uses a
          rail + main layout, so the toggle is meaningless there and hidden. */}
      <div>
        {meta.templateId === 'sidebar' ? (
          <>
            {/* Every section really does render in either column. Until this note
                existed, four of them silently vanished from the preview when moved
                to the rail, so the guidance here is preference, not a constraint. */}
            <p className="rounded-control bg-surface-subtle px-3 py-2 text-xs leading-relaxed text-fg-muted">
              Every section can go in either column. The rail is {meta.sidebarRailWidth ?? 33}% of the page width,
              so short sections like Skills and Languages suit it best.
            </p>
          </>
        ) : (
          <>
            <div className="flex gap-2" role="group" aria-label="Layout">
              {(meta.templateId === 'minimal'
                ? (['single-column'] as const)
                : (['single-column', 'two-column'] as const)
              ).map((layout) => (
                <button
                  key={layout}
                  type="button"
                  aria-pressed={meta.layout === layout}
                  onClick={() => setMeta({ layout })}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 text-sm rounded-control border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:min-h-10 ${
                    meta.layout === layout
                      ? 'border-primary bg-secondary text-fg-heading font-medium'
                      : 'border-border text-fg-muted hover:border-input hover:bg-surface-subtle'
                  }`}
                >
                  <svg aria-hidden="true" viewBox="0 0 28 20" className="h-5 w-7">
                    {layout === 'single-column' ? (
                      <rect x="4" y="2" width="20" height="16" rx="2" fill="currentColor" opacity="0.35" />
                    ) : (<>
                      <rect x="3" y="2" width="9" height="16" rx="2" fill="currentColor" opacity="0.35" />
                      <rect x="16" y="2" width="9" height="16" rx="2" fill="currentColor" opacity="0.35" />
                    </>)}
                  </svg>
                  {layout === 'single-column' ? 'Single column' : 'Two columns'}
                </button>
              ))}
            </div>
            {meta.templateId === 'minimal' && (
              <p className="text-xs text-fg-subtle mt-1.5">The Minimal template supports a single column only.</p>
            )}
          </>
        )}
      </div>

      {/* Section columns — visible in two-column mode (never for minimal, which
          may carry a stale two-column layout from a previously saved resume),
          and always for sidebar since it always renders a rail + main split. */}
      {((meta.layout === 'two-column' && meta.templateId !== 'minimal') || meta.templateId === 'sidebar') && (
        <div>
          <p className={labelClass}>Section columns</p>
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              accessibility={{
                announcements: buildSectionAnnouncements(meta.sectionOrder, customSections),
                screenReaderInstructions: sectionScreenReaderInstructions,
              }}
            >
              <SortableContext
                items={meta.sectionOrder}
                strategy={verticalListSortingStrategy}
              >
                {meta.sectionOrder.map((sectionKey) => (
                  <SortableColumnRow
                    key={sectionKey}
                    sectionKey={sectionKey}
                    label={getSectionLabel(sectionKey, customSections)}
                    side={getColumnSide(sectionKey, meta.columnAssignment ?? {}, colDefaults)}
                    onToggle={() => handleColumnToggle(sectionKey)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <p className="text-xs text-fg-subtle mt-1.5">Drag to reorder. Pick Left or Right to move a section.</p>
        </div>
      )}

      {/* Rail width — sidebar-only. meta.sidebarRailWidth may be missing on a
          résumé saved before this field existed, so fall back to the schema
          default (33) the same way meta.columnAssignment ?? {} is handled
          everywhere else in this codebase. */}
      {meta.templateId === 'sidebar' && (
        <div>
          <label className={labelClass}>
            Rail width - <span className="font-mono">{meta.sidebarRailWidth ?? 33}%</span>
          </label>
          <input type="range" min={20} max={40} step={1}
            aria-label="Rail width"
            value={meta.sidebarRailWidth ?? 33}
            onChange={(e) => setMeta({ sidebarRailWidth: parseFloat(e.target.value) })}
            className="w-full accent-primary" />
          <div className="flex justify-between text-xs text-fg-subtle mt-0.5">
            <span>20% (min)</span><span>40%</span>
          </div>
        </div>
      )}
      </div>
  )
}
