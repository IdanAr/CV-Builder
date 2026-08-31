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
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { getColumnSide, SIDEBAR_COLUMN_DEFAULTS } from '@/lib/get-column-side'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import { FONT_SUBSTITUTES } from '@/lib/fonts/families'

/**
 * Derived, not restated. A hardcoded list here was the last unguarded copy of
 * the font names: adding one that FONT_SUBSTITUTES does not know would leave
 * both `webFontFamily` and `pdfFontFamily` falling through to the default, so
 * the user picks a font and silently gets Carlito in the preview *and* the
 * PDF — the exact divergence this phase exists to remove — with the whole
 * suite green. `families.ts` is client-safe by construction, so importing it
 * from this 'use client' panel is legal.
 */
const ATS_FONTS = Object.keys(FONT_SUBSTITUTES)

function TemplateThumb({ id, active }: { id: string; active: boolean }) {
  const ink = active ? '#4f46e5' : '#a5b4fc'
  const soft = active ? '#c7d2fe' : '#e0e7ff'
  return (
    <svg aria-hidden="true" viewBox="0 0 40 52" className="h-14 w-10 shrink-0 rounded-[3px] bg-white shadow-sm ring-1 ring-indigo-100">
      {id === 'classic' && (<>
        <rect x="6" y="6" width="28" height="3" rx="1" fill={ink} />
        <rect x="6" y="12" width="28" height="1" fill={soft} />
        <rect x="6" y="17" width="20" height="2" rx="1" fill={soft} />
        <rect x="6" y="22" width="24" height="2" rx="1" fill={soft} />
        <rect x="6" y="27" width="18" height="2" rx="1" fill={soft} />
      </>)}
      {id === 'modern' && (<>
        <rect x="0" y="0" width="40" height="12" fill={ink} />
        <rect x="6" y="17" width="20" height="2" rx="1" fill={soft} />
        <rect x="6" y="22" width="24" height="2" rx="1" fill={soft} />
        <rect x="6" y="27" width="18" height="2" rx="1" fill={soft} />
      </>)}
      {id === 'minimal' && (<>
        <rect x="6" y="8" width="18" height="3" rx="1" fill={ink} />
        <rect x="6" y="16" width="26" height="1.5" rx="0.75" fill={soft} />
        <rect x="6" y="20" width="22" height="1.5" rx="0.75" fill={soft} />
        <rect x="6" y="24" width="24" height="1.5" rx="0.75" fill={soft} />
      </>)}
      {id === 'executive' && (<>
        <rect x="6" y="6" width="28" height="3" rx="1" fill={ink} />
        <rect x="6" y="11" width="28" height="0.8" fill={ink} />
        <rect x="6" y="13" width="28" height="0.8" fill={ink} />
        <rect x="6" y="19" width="22" height="2" rx="1" fill={soft} />
        <rect x="6" y="24" width="26" height="2" rx="1" fill={soft} />
      </>)}
      {id === 'sidebar' && (<>
        <rect x="0" y="0" width="13" height="52" fill={ink} />
        <rect x="17" y="8" width="18" height="3" rx="1" fill={soft} />
        <rect x="17" y="15" width="16" height="2" rx="1" fill={soft} />
        <rect x="17" y="20" width="18" height="2" rx="1" fill={soft} />
      </>)}
    </svg>
  )
}

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Clean, professional, thin dividers' },
  { id: 'modern', label: 'Modern', desc: 'Bold header block, accent titles' },
  { id: 'minimal', label: 'Minimal', desc: 'Typography-only, maximum ATS compatibility' },
  { id: 'executive', label: 'Executive', desc: 'Serif, double-rule header, senior industries' },
  { id: 'sidebar', label: 'Sidebar', desc: 'Colored left rail, skills & languages in panel' },
]

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}){1,2}$/

// A curated set of professional, resume-appropriate colors shown as a quick-pick
// palette, so the color controls visually read as "a palette to choose from"
// rather than a single opaque swatch + hex box. Free-form custom colors are
// still available via the native picker and the hex text input.
const PRESET_COLORS: Array<{ name: string; hex: string }> = [
  { name: 'Black', hex: '#000000' },
  { name: 'Charcoal', hex: '#1f2937' },
  { name: 'Navy', hex: '#1e3a8a' },
  { name: 'Classic Blue', hex: '#0066cc' },
  { name: 'Teal', hex: '#0f766e' },
  { name: 'Forest Green', hex: '#15803d' },
  { name: 'Burgundy', hex: '#9f1239' },
  { name: 'Violet', hex: '#7c3aed' },
]

const SECTION_LABELS: Record<string, string> = {
  work: 'Work',
  education: 'Education',
  skills: 'Skills',
  volunteer: 'Volunteer',
  languages: 'Languages',
}

function getSectionLabel(sectionKey: string, data: ResumeData): string {
  if (!sectionKey.startsWith('custom:')) {
    return SECTION_LABELS[sectionKey] ?? sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)
  }
  const id = sectionKey.slice('custom:'.length)
  const cs = data.customSections?.find((s) => s.id === id)
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

function buildSectionAnnouncements(sectionOrder: string[], data: ResumeData): Announcements {
  function describePosition(sectionKey: string): string {
    const index = sectionOrder.indexOf(sectionKey)
    return index === -1 ? '' : `position ${index + 1} of ${sectionOrder.length}`
  }

  return {
    onDragStart({ active }) {
      return `Picked up ${getSectionLabel(String(active.id), data)} at ${describePosition(String(active.id))}.`
    },
    onDragOver({ active, over }) {
      const label = getSectionLabel(String(active.id), data)
      return over
        ? `${label} is over ${describePosition(String(over.id))}.`
        : `${label} is no longer over a droppable area.`
    },
    onDragEnd({ active, over }) {
      const label = getSectionLabel(String(active.id), data)
      return over
        ? `${label} was moved to ${describePosition(String(over.id))}.`
        : `${label} was dropped.`
    },
    onDragCancel({ active }) {
      return `Moving ${getSectionLabel(String(active.id), data)} was cancelled.`
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
    boxShadow: isDragging ? '0 4px 12px rgba(79,70,229,0.15)' : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-2.5 py-1.5 border-b border-indigo-50 last:border-b-0 transition-colors hover:bg-indigo-50/50"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-indigo-300 cursor-grab active:cursor-grabbing text-base select-none"
        aria-label="Drag to reorder"
      >
        ⠿
      </span>
      <span className="flex-1 text-sm text-gray-700">{label}</span>

<div className="flex p-0.5 bg-indigo-50/80 border border-indigo-100 rounded-md text-xs font-medium">
        <button
          type="button"
          onClick={side === 'left' ? undefined : onToggle}
          className={`px-3 py-1 rounded-[4px] transition-all duration-200 ${
            side === 'left'
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
              : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100/50'
          }`}
        >
          Left
        </button>
        <button
          type="button"
          onClick={side === 'right' ? undefined : onToggle}
          className={`px-3 py-1 rounded-[4px] transition-all duration-200 ${
            side === 'right'
              ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5'
              : 'text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100/50'
          }`}
        >
          Right
        </button>
      </div>
    </div>
  )
}

export function DesignPanel() {
  const meta = useResumeEditorStore((s) => s.meta)
  const data = useResumeEditorStore((s) => s.data)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  // PointerSensor alone dropped keyboard support entirely — a keyboard-only
  // user could not reorder sections at all, with no up/down button fallback.
  // KeyboardSensor restores it, mirroring ApplicationsBoard.tsx's setup.
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const [primaryColorDraft, setPrimaryColorDraft] = React.useState(meta.primaryColor)
  const [primaryColorTouched, setPrimaryColorTouched] = React.useState(false)
  const [accentColorDraft, setAccentColorDraft] = React.useState(meta.accentColor)
  const [accentColorTouched, setAccentColorTouched] = React.useState(false)

  // Keep the drafts in sync when meta changes from *outside* this component's
  // own inputs (undo/redo, loading a different resume, etc.) — without this,
  // the text field would keep showing a stale value after an external change
  // even though the swatch (which reads meta directly) updates correctly.
  // This is a no-op when the change originated from this component's own
  // valid-hex commit, since the draft already equals the new meta value.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrimaryColorDraft(meta.primaryColor)
    setPrimaryColorTouched(false)
  }, [meta.primaryColor])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAccentColorDraft(meta.accentColor)
    setAccentColorTouched(false)
  }, [meta.accentColor])

  function handlePrimaryColorSwatchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setMeta({ primaryColor: value })
    setPrimaryColorDraft(value)
    setPrimaryColorTouched(false)
  }

  function handlePrimaryColorTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setPrimaryColorDraft(value)
    setPrimaryColorTouched(true)
    if (HEX_COLOR_RE.test(value)) {
      setMeta({ primaryColor: value })
    }
  }

  function handlePrimaryColorTextBlur() {
    if (!HEX_COLOR_RE.test(primaryColorDraft)) {
      setPrimaryColorDraft(meta.primaryColor)
      setPrimaryColorTouched(false)
    }
  }

  function handlePrimaryColorPresetSelect(hex: string) {
    setMeta({ primaryColor: hex })
    setPrimaryColorDraft(hex)
    setPrimaryColorTouched(false)
  }

  function handleAccentColorSwatchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setMeta({ accentColor: value })
    setAccentColorDraft(value)
    setAccentColorTouched(false)
  }

  function handleAccentColorTextChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    setAccentColorDraft(value)
    setAccentColorTouched(true)
    if (HEX_COLOR_RE.test(value)) {
      setMeta({ accentColor: value })
    }
  }

  function handleAccentColorTextBlur() {
    if (!HEX_COLOR_RE.test(accentColorDraft)) {
      setAccentColorDraft(meta.accentColor)
      setAccentColorTouched(false)
    }
  }

  function handleAccentColorPresetSelect(hex: string) {
    setMeta({ accentColor: hex })
    setAccentColorDraft(hex)
    setAccentColorTouched(false)
  }

  const selectClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
  const labelClass = 'block text-xs font-medium text-indigo-600 mb-1'

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
    <div className="max-w-sm mx-auto py-6 px-4 space-y-6">
      {/* Template selector */}
      <div>
        <p className={labelClass}>Template</p>
        <div className="space-y-2" role="group" aria-label="Template">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={meta.templateId === t.id}
              onClick={() => setMeta({ templateId: t.id })}
              className={`w-full flex items-center gap-3 text-left px-3 py-2.5 rounded-xl border transition-all duration-200 ${
                meta.templateId === t.id
                  ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                  : 'border-indigo-100 hover:border-indigo-300 hover:shadow-sm hover:-translate-y-px'
              }`}
            >
              <TemplateThumb id={t.id} active={meta.templateId === t.id} />
              <div className="min-w-0">
                <div className="font-medium text-sm">{t.label}</div>
                <div className="text-xs text-indigo-400 mt-0.5">{t.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Layout toggle — Minimal is single-column only; Sidebar always uses a
          rail + main layout, so the toggle is meaningless there and hidden. */}
      <div>
        <p className={labelClass}>Layout</p>
        {meta.templateId === 'sidebar' ? (
          <p className="text-xs text-indigo-300 mt-1.5">The Sidebar template always uses a rail + main column layout.</p>
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
                  className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 text-sm rounded-xl border transition-all duration-200 ${
                    meta.layout === layout
                      ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium shadow-sm'
                      : 'border-indigo-100 text-indigo-500 hover:border-indigo-300 hover:shadow-sm'
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
              <p className="text-xs text-indigo-300 mt-1.5">The Minimal template supports a single column only.</p>
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
          <div className="bg-white border border-indigo-100 rounded-lg overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
              accessibility={{
                announcements: buildSectionAnnouncements(meta.sectionOrder, data),
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
                    label={getSectionLabel(sectionKey, data)}
                    side={getColumnSide(sectionKey, meta.columnAssignment ?? {}, colDefaults)}
                    onToggle={() => handleColumnToggle(sectionKey)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <p className="text-xs text-indigo-300 mt-1.5 text-center">⠿ drag to reorder · click badge to switch column</p>
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
            className="w-full accent-indigo-600" />
          <div className="flex justify-between text-xs text-indigo-300 mt-0.5">
            <span>20% (min)</span><span>40%</span>
          </div>
        </div>
      )}

      {/* Fonts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Body font</label>
          <select value={meta.fontFamily} onChange={(e) => setMeta({ fontFamily: e.target.value })}
            className={selectClass}>
            {ATS_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Heading font</label>
          <select value={meta.headerFontFamily} onChange={(e) => setMeta({ headerFontFamily: e.target.value })}
            className={selectClass}>
            {ATS_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Colors — stacked vertically so each picker's swatch row and preset
          palette get the panel's full width */}
      <div className="space-y-5">
        <div>
          <label className={labelClass}>Primary color</label>
          <div className="flex gap-2 items-center mb-2">
            <input type="color" value={meta.primaryColor}
              onChange={handlePrimaryColorSwatchChange}
              aria-label="Custom primary color"
              title="Custom color"
              className="h-9 w-9 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-indigo-200 cursor-pointer p-0 overflow-hidden" />
            <input type="text" value={primaryColorDraft}
              onChange={handlePrimaryColorTextChange}
              onBlur={handlePrimaryColorTextBlur}
              placeholder="#000000" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Primary color presets">
            {PRESET_COLORS.map(({ name, hex }) => {
              const isActive = meta.primaryColor.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={hex}
                  type="button"
                  title={name}
                  aria-label={`Set primary color to ${name}`}
                  aria-pressed={isActive}
                  onClick={() => handlePrimaryColorPresetSelect(hex)}
                  style={{ backgroundColor: hex }}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                    isActive ? 'border-indigo-600 ring-2 ring-indigo-300 ring-offset-1' : 'border-white shadow-sm'
                  }`}
                />
              )
            })}
          </div>
          {primaryColorTouched && !HEX_COLOR_RE.test(primaryColorDraft) && (
            <p className="text-sm text-red-500 mt-1">Enter a valid hex color (e.g. #0066cc)</p>
          )}
        </div>
        <div>
          <label className={labelClass}>Accent color</label>
          <div className="flex gap-2 items-center mb-2">
            <input type="color" value={meta.accentColor}
              onChange={handleAccentColorSwatchChange}
              aria-label="Custom accent color"
              title="Custom color"
              className="h-9 w-9 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-indigo-200 cursor-pointer p-0 overflow-hidden" />
            <input type="text" value={accentColorDraft}
              onChange={handleAccentColorTextChange}
              onBlur={handleAccentColorTextBlur}
              placeholder="#0066cc" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Accent color presets">
            {PRESET_COLORS.map(({ name, hex }) => {
              const isActive = meta.accentColor.toLowerCase() === hex.toLowerCase()
              return (
                <button
                  key={hex}
                  type="button"
                  title={name}
                  aria-label={`Set accent color to ${name}`}
                  aria-pressed={isActive}
                  onClick={() => handleAccentColorPresetSelect(hex)}
                  style={{ backgroundColor: hex }}
                  className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-1 ${
                    isActive ? 'border-indigo-600 ring-2 ring-indigo-300 ring-offset-1' : 'border-white shadow-sm'
                  }`}
                />
              )
            })}
          </div>
          {accentColorTouched && !HEX_COLOR_RE.test(accentColorDraft) && (
            <p className="text-sm text-red-500 mt-1">Enter a valid hex color (e.g. #0066cc)</p>
          )}
        </div>
      </div>

      {/* Margins */}
      <div>
        <label className={labelClass}>
          Page margins - <span className="font-mono">{meta.pageMargins.toFixed(1)}&quot;</span>
        </label>
        <input type="range" min={0.5} max={1.5} step={0.1}
          value={meta.pageMargins}
          onChange={(e) => setMeta({ pageMargins: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600" />
        <div className="flex justify-between text-xs text-indigo-300 mt-0.5">
          <span>0.5&quot; (min)</span><span>1.5&quot;</span>
        </div>
      </div>

      {/* Line spacing */}
      <div>
        <label className={labelClass}>
          Line spacing - <span className="font-mono">{meta.lineSpacing.toFixed(2)}</span>
        </label>
        <input type="range" min={1.0} max={1.15} step={0.05}
          value={meta.lineSpacing}
          onChange={(e) => setMeta({ lineSpacing: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600" />
        <div className="flex justify-between text-xs text-indigo-300 mt-0.5">
          <span>1.00</span><span>1.15</span>
        </div>
      </div>

    </div>
  )
}
