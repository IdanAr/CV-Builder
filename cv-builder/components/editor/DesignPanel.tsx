'use client'

import React from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { getColumnSide } from '@/lib/get-column-side'
import type { ResumeData } from '@/lib/schemas/resume.zod'

const ATS_FONTS = [
  'Calibri', 'Arial', 'Helvetica', 'Garamond', 'Cambria', 'Georgia',
  'Lato', 'Roboto', 'IBM Plex Sans',
]

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Clean, professional, thin dividers' },
  { id: 'modern', label: 'Modern', desc: 'Bold header block, accent titles' },
  { id: 'minimal', label: 'Minimal', desc: 'Typography-only, maximum ATS compatibility' },
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
      className="flex items-center gap-2 px-2.5 py-1.5 border-b border-indigo-50 last:border-b-0"
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

  const sensors = useSensors(useSensor(PointerSensor))

  const selectClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
  const labelClass = 'block text-xs font-medium text-indigo-600 mb-1'

  function handleColumnDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = meta.sectionOrder.indexOf(active.id as string)
    const newIndex = meta.sectionOrder.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    setMeta({ sectionOrder: arrayMove(meta.sectionOrder, oldIndex, newIndex) })
  }

  function handleColumnToggle(sectionKey: string) {
    const current = getColumnSide(sectionKey, meta.columnAssignment ?? {})
    const next: 'left' | 'right' = current === 'left' ? 'right' : 'left'
    setMeta({ columnAssignment: { ...meta.columnAssignment, [sectionKey]: next } })
  }

  return (
    <div className="max-w-sm mx-auto py-6 px-4 space-y-6">
      {/* Template selector */}
      <div>
        <p className={labelClass}>Template</p>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMeta({ templateId: t.id })}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                meta.templateId === t.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-indigo-100 hover:border-indigo-300'
              }`}
            >
              <div className="font-medium text-sm">{t.label}</div>
              <div className="text-xs text-indigo-400 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Layout toggle */}
      <div>
        <p className={labelClass}>Layout</p>
        <div className="flex gap-2">
          {(['single-column', 'two-column'] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => setMeta({ layout })}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                meta.layout === layout
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-indigo-100 text-indigo-500 hover:border-indigo-300'
              }`}
            >
              {layout === 'single-column' ? 'Single column' : 'Two columns'}
            </button>
          ))}
        </div>
      </div>

      {/* Section columns — only visible in two-column mode */}
      {meta.layout === 'two-column' && (
        <div>
          <p className={labelClass}>Section columns</p>
          <div className="bg-white border border-indigo-100 rounded-lg overflow-hidden">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleColumnDragEnd}
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
                    side={getColumnSide(sectionKey, meta.columnAssignment ?? {})}
                    onToggle={() => handleColumnToggle(sectionKey)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <p className="text-xs text-indigo-300 mt-1.5 text-center">⠿ drag to reorder · click badge to switch column</p>
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

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Primary color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={meta.primaryColor}
              onChange={(e) => setMeta({ primaryColor: e.target.value })}
              className="h-8 w-10 rounded border border-indigo-200 cursor-pointer p-0.5" />
            <input type="text" value={meta.primaryColor}
              onChange={(e) => setMeta({ primaryColor: e.target.value })}
              placeholder="#000000" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Accent color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              className="h-8 w-10 rounded border border-indigo-200 cursor-pointer p-0.5" />
            <input type="text" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              placeholder="#0066cc" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Margins */}
      <div>
        <label className={labelClass}>
          Page margins — <span className="font-mono">{meta.pageMargins.toFixed(1)}&quot;</span>
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
          Line spacing — <span className="font-mono">{meta.lineSpacing.toFixed(2)}</span>
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
