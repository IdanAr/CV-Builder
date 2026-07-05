'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useResumeEditorStore, initAutoSave } from '@/lib/stores/resume-editor.store'
import { EditTab } from './EditTab'
import { PreviewTab } from './PreviewTab'
import { DesignPanel } from './DesignPanel'
import { AtsScorePanel } from '@/components/ats/AtsScorePanel'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'
import { ExportMenu } from './ExportMenu'
import { toast } from '@/lib/stores/toast.store'
import type { ExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

type Tab = 'edit' | 'design' | 'ats'

const TAB_LABELS: Record<Tab, string> = { edit: 'Edit', design: 'Design', ats: 'ATS' }

const PANEL_WIDTH_KEY = 'cv-builder:panel-width'
const DEFAULT_PANEL_WIDTH = 500 // Increased to give the UI breathing room initially

function clampPanelWidth(x: number): number {
  // Safety check for Next.js SSR
  if (typeof window === 'undefined') return DEFAULT_PANEL_WIDTH

  // 1. Prevent squishing on desktop: hard minimum of 500px.
  // 2. Prevent breaking on mobile: if screen is < 500px, limit the minimum to the screen width.
  const dynamicMinWidth = Math.min(500, window.innerWidth)

  // 3. Max width: 60% of the screen, but ensure it never drops below the minimum width.
  const maxAllowed = Math.max(dynamicMinWidth, Math.floor(window.innerWidth * 0.6))

  // Clamp the dragged width (x) between our dynamic bounds
  return Math.max(dynamicMinWidth, Math.min(maxAllowed, x))
}

export interface EditorShellProps {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
  user?: { name?: string | null; email?: string | null; image?: string | null }
}

export function EditorShell({ resumeId, title, data, meta, user }: EditorShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('edit')
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [panelWidth, setPanelWidth] = useState(DEFAULT_PANEL_WIDTH)
  const [dividerActive, setDividerActive] = useState(false)
  const draggingRef = useRef(false)
  const dragStartWidthRef = useRef(DEFAULT_PANEL_WIDTH)

  const storeTitle = useResumeEditorStore((s) => s.title)
  const isDirty = useResumeEditorStore((s) => s.isDirty)
  const isSaving = useResumeEditorStore((s) => s.isSaving)
  const saveError = useResumeEditorStore((s) => s.saveError)
  const setTitle = useResumeEditorStore((s) => s.setTitle)
  const hydrate = useResumeEditorStore((s) => s.hydrate)
  const undo = useResumeEditorStore((s) => s.undo)
  const redo = useResumeEditorStore((s) => s.redo)
  const canUndo = useResumeEditorStore((s) => s.canUndo)
  const canRedo = useResumeEditorStore((s) => s.canRedo)

  useEffect(() => {
    hydrate(resumeId, title, data, meta)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return initAutoSave()
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY)
    if (saved) {
      const w = parseInt(saved, 10)
      if (!isNaN(w)) {
        setPanelWidth(clampPanelWidth(w))
      }
    }
  }, [])

  function handleDividerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    dragStartWidthRef.current = panelWidth
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setDividerActive(true)
  }

  function handleDividerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    setPanelWidth(clampPanelWidth(e.clientX))
  }

  function handleDividerPointerUp() {
    draggingRef.current = false
    setDividerActive(false)
    setPanelWidth((w) => {
      localStorage.setItem(PANEL_WIDTH_KEY, String(w))
      return w
    })
  }

  function handleDividerPointerCancel() {
    draggingRef.current = false
    setDividerActive(false)
    setPanelWidth(dragStartWidthRef.current)
  }

  function handleJsonExport() {
    const s = useResumeEditorStore.getState()
    const blob = new Blob([JSON.stringify({ data: s.data, meta: s.meta }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${s.title.replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExport(format: 'pdf' | 'docx', mode: ExportMode = 'designed') {
    const { resumeId: rid, title: t, meta: m } = useResumeEditorStore.getState()
    try {
      const res = await fetch(`/api/resumes/${rid}/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const templateName = m.templateId.charAt(0).toUpperCase() + m.templateId.slice(1)
      const modeSuffix = mode === 'ats' ? '-ATS' : ''
      a.download = `${t.replace(/\s+/g, '-')}-${templateName}${modeSuffix}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} exported`)
    } catch {
      toast.error(`${format.toUpperCase()} export failed. Please try again.`)
    }
  }

  const saveStatus = isSaving ? 'Saving…' : isDirty ? '● Unsaved' : 'Saved'

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top navbar */}
      <AppNavbar
        actions={
          <div className="flex items-center gap-3 flex-1">
            <Link
              href="/dashboard"
              className="mr-auto text-lg font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              ← My CVs
            </Link>
            <span className="text-indigo-200">|</span>
            <span className={`text-xs ${saveError ? 'text-red-500' : 'text-indigo-400'}`}>
              {saveError ?? saveStatus}
            </span>
            <div className="w-px h-4 bg-indigo-200 mx-1" />
            <button
              onClick={handleJsonExport}
              className="text-xs border border-indigo-200 text-indigo-600 rounded px-3 py-1.5 hover:bg-indigo-50 transition-colors"
            >
              JSON
            </button>
            <ExportMenu onExport={handleExport} />
            {user && (
              <>
                <div className="w-px h-4 bg-indigo-200" />
                <UserProfileButton user={user} />
              </>
            )}
          </div>
        }
      />

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {previewExpanded ? (
          <div className="w-9 min-w-[36px] bg-indigo-900 flex flex-col items-center py-3 gap-4 border-r border-indigo-800 shrink-0">
            {(['edit', 'design', 'ats'] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setPreviewExpanded(false); setActiveTab(tab) }}
                className="text-xs text-indigo-300 hover:text-white transition-colors"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-col border-r border-white/20 bg-white/40 backdrop-blur-xl shrink-0"
            style={{ width: panelWidth }}
          >
            {/* Title */}
            <div className="flex items-center gap-3 px-4 h-12 border-b border-indigo-100 shrink-0 bg-white/50">
              <input
                type="text"
                value={storeTitle}
                onChange={(e) => setTitle(e.target.value)}
                className="font-semibold text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 min-w-0 flex-1 text-indigo-900"
              />
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-indigo-100 shrink-0 bg-white/50">
              {(['edit', 'design', 'ats'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Sticky Undo/Redo — only on Edit tab */}
            {activeTab === 'edit' && (
              <div className="flex items-center gap-1 px-3 py-1.5 border-b border-indigo-100 shrink-0 bg-indigo-50/60">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ↩ Undo
                </button>
                <button
                  onClick={redo}
                  disabled={!canRedo}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-indigo-200 text-indigo-600 hover:bg-indigo-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Redo ↪
                </button>
              </div>
            )}

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              <div className={activeTab === 'edit' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><EditTab /></EditorErrorBoundary>
              </div>
              <div className={activeTab === 'design' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><DesignPanel /></EditorErrorBoundary>
              </div>
              <div className={activeTab === 'ats' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><AtsScorePanel /></EditorErrorBoundary>
              </div>
            </div>
          </div>
        )}

        {/* Resize divider — only when panel is not collapsed */}
        {!previewExpanded && (
          <div
            className={`w-1 shrink-0 cursor-col-resize select-none transition-colors ${
              dividerActive ? 'bg-indigo-400/40' : 'hover:bg-indigo-400/40 bg-transparent'
            }`}
            onPointerDown={handleDividerPointerDown}
            onPointerMove={handleDividerPointerMove}
            onPointerUp={handleDividerPointerUp}
            onPointerCancel={handleDividerPointerCancel}
          />
        )}

        {/* Right panel — preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/30 backdrop-blur-sm">
         <div className="flex items-center gap-2 px-3 h-12 border-b border-indigo-100 bg-white/50 shrink-0">
            <span className="text-xs font-medium text-indigo-500 flex-1">Live Preview</span>
            <button
              onClick={() => setPreviewExpanded((v) => !v)}
              title={previewExpanded ? 'Collapse preview' : 'Expand preview'}
              className={`text-sm border rounded px-2 py-1 transition-colors ${
                previewExpanded
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-indigo-200 text-indigo-500 hover:bg-indigo-50'
              }`}
            >
              ⛶
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <EditorErrorBoundary><PreviewTab /></EditorErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
