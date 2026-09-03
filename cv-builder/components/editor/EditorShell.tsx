'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { handleTablistKeyDown, tabIndexFor } from '@/lib/tablist-keys'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useResumeEditorStore, initAutoSave, flushSave } from '@/lib/stores/resume-editor.store'
import { EditTab } from './EditTab'
import { PreviewTab } from './PreviewTab'
import { DesignPanel } from './DesignPanel'
import { AtsScorePanel } from '@/components/ats/AtsScorePanel'
import { CoverLetterPanel } from '@/components/coverletter/CoverLetterPanel'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { UserProfileButton } from '@/components/ui/UserProfileButton'
import { ExportMenu } from './ExportMenu'
import { toast } from '@/lib/stores/toast.store'
import type { ExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

type Tab = 'edit' | 'design' | 'ats' | 'coverLetter'

const TAB_LABELS: Record<Tab, string> = { edit: 'Edit', design: 'Design', ats: 'ATS', coverLetter: 'Cover Letter' }

const PANEL_WIDTH_KEY = 'cv-builder:panel-width'
const DEFAULT_PANEL_WIDTH = 500 // Increased to give the UI breathing room initially

// Below this width, the resizable side-by-side layout is replaced by a
// single full-width panel with an Edit/Preview switcher (matches Tailwind's `md`).
const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)'

type MobileView = 'edit' | 'preview'

/** The effective min/max a panel width can be clamped to, given the current viewport. */
function getPanelWidthBounds(): { min: number; max: number } {
  // Safety check for Next.js SSR
  if (typeof window === 'undefined') return { min: DEFAULT_PANEL_WIDTH, max: DEFAULT_PANEL_WIDTH }

  // 1. Prevent squishing on desktop: hard minimum of 500px.
  // 2. Prevent breaking on mobile: if screen is < 500px, limit the minimum to the screen width.
  const min = Math.min(500, window.innerWidth)

  // 3. Max width: 60% of the screen, but ensure it never drops below the minimum width.
  const max = Math.max(min, Math.floor(window.innerWidth * 0.6))

  return { min, max }
}

function clampPanelWidth(x: number): number {
  const { min, max } = getPanelWidthBounds()
  return Math.max(min, Math.min(max, x))
}

// Keyboard resize step sizes for the divider (arrow key / shift+arrow key).
const RESIZE_STEP = 16
const RESIZE_STEP_LARGE = 64

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
  // getPanelWidthBounds() reads window.innerWidth, which doesn't exist during
  // SSR — calling it directly in the divider's aria-valuemin/max below would
  // render DEFAULT_PANEL_WIDTH on the server but the real viewport-derived
  // bounds on the client's very first (hydration) pass, a mismatch React
  // hydration can't reconcile. Gating on `mounted` keeps that first client
  // render identical to the server's, then swaps in the real bounds on the
  // next (client-only) render once mounted flips true.
  const [mounted, setMounted] = useState(false)
  const [mobileView, setMobileView] = useState<MobileView>('edit')
  const draggingRef = useRef(false)
  const dragStartWidthRef = useRef(DEFAULT_PANEL_WIDTH)
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT_QUERY)
  const reduceMotion = useReducedMotion()

  const storeTitle = useResumeEditorStore((s) => s.title)
  const isDirty = useResumeEditorStore((s) => s.isDirty)
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const isSaving = useResumeEditorStore((s) => s.isSaving)
  const saveError = useResumeEditorStore((s) => s.saveError)
  const setTitle = useResumeEditorStore((s) => s.setTitle)
  const hydrate = useResumeEditorStore((s) => s.hydrate)
  const undo = useResumeEditorStore((s) => s.undo)
  const redo = useResumeEditorStore((s) => s.redo)
  const canUndo = useResumeEditorStore((s) => s.canUndo)
  const canRedo = useResumeEditorStore((s) => s.canRedo)
  const pendingFocus = useResumeEditorStore((s) => s.pendingFocus)

  useEffect(() => {
    hydrate(resumeId, title, data, meta)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return initAutoSave()
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!pendingFocus) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveTab('edit')
    setMobileView('edit')
  }, [pendingFocus])

  useEffect(() => {
    const saved = localStorage.getItem(PANEL_WIDTH_KEY)
    if (saved) {
      const w = parseInt(saved, 10)
      if (!isNaN(w)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
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

  function handleDividerKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const step = e.shiftKey ? RESIZE_STEP_LARGE : RESIZE_STEP
    let delta = 0
    if (e.key === 'ArrowLeft') delta = -step
    else if (e.key === 'ArrowRight') delta = step
    else return

    e.preventDefault()
    setPanelWidth((w) => {
      const next = clampPanelWidth(w + delta)
      localStorage.setItem(PANEL_WIDTH_KEY, String(next))
      return next
    })
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
    // A slow render (large résumé, cold PDF worker) previously left the trigger
    // fully enabled with no spinner, so users reopened the menu and clicked
    // again — duplicate downloads and duplicate server work, with no way to
    // tell the first request was still running.
    if (isExporting) return
    setIsExporting(true)
    try {
      await runExport(format, mode)
    } finally {
      setIsExporting(false)
    }
  }

  async function runExport(format: 'pdf' | 'docx', mode: ExportMode) {
    try {
      // The export routes always re-read the resume from the database rather
      // than trusting the client, so any edit still waiting on the debounced
      // autosave (e.g. a Design-panel change made just before exporting)
      // would otherwise be silently missing from the exported file even
      // though the live preview already reflects it.
      await flushSave()
    } catch {
      toast.error(`Couldn't save your latest changes before exporting. Please try again.`)
      return
    }
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

  /**
   * Leaving the editor mid-edit used to discard work silently: the store wires
   * only a `beforeunload` handler, which never fires for Next's client-side
   * navigation, so clicking this link inside the 1s autosave debounce — or
   * while a save was failing — dropped the pending edits.
   *
   * Rather than interrupt with a confirm, flush the save first and navigate
   * once it lands. Only a genuine save failure asks the user anything.
   */
  async function handleLeaveEditor(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let the browser handle modifier-clicks (new tab/window) untouched.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    if (!isDirty && !saveError) return
    e.preventDefault()
    if (isLeaving) return
    setIsLeaving(true)
    try {
      await flushSave()
      router.push('/dashboard')
    } catch {
      if (window.confirm("Your latest changes couldn't be saved. Leave anyway and lose them?")) {
        router.push('/dashboard')
      }
    } finally {
      setIsLeaving(false)
    }
  }

  const saveStatus = isSaving ? 'Saving…' : isDirty ? '● Unsaved' : 'Saved'

  // Shared between the desktop side-by-side layout and the mobile
  // single-panel view — the editor panel's contents never change,
  // only how much of the screen it occupies.
  const editPanelBody = (
    <>
      {/* Title */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-indigo-100 shrink-0 bg-white/50">
        <input
          type="text"
          value={storeTitle}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Resume title"
          className="font-semibold text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 min-w-0 flex-1 text-indigo-900"
        />
      </div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Editor sections"
        onKeyDown={handleTablistKeyDown}
        className="flex border-b border-indigo-100 shrink-0 bg-white/50"
      >
        {(['edit', 'design', 'ats', 'coverLetter'] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`editor-tab-${tab}`}
            aria-controls={`editor-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={tabIndexFor(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
            className={`relative flex items-center justify-center min-h-[44px] px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab ? 'text-indigo-600' : 'text-fg-muted hover:text-fg-body'
            }`}
          >
            {TAB_LABELS[tab]}
            {activeTab === tab && (
              <motion.span
                layoutId="editor-tab-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-indigo-600"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Sticky Undo/Redo — on Edit and Design tabs (both mutate the shared
          data/meta history; ATS is read-only and has nothing to undo) */}
      {(activeTab === 'edit' || activeTab === 'design') && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-indigo-100 shrink-0 bg-indigo-50/60">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="flex items-center justify-center gap-1 min-h-[40px] px-2 py-1 text-xs rounded-lg shadow-sm border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:shadow disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            ↩ Undo
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="flex items-center justify-center gap-1 min-h-[40px] px-2 py-1 text-xs rounded-lg shadow-sm border border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:shadow disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            Redo ↪
          </button>
        </div>
      )}

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <div role="tabpanel" id="editor-panel-edit" aria-labelledby="editor-tab-edit" className={activeTab === 'edit' ? 'block' : 'hidden'}>
          <EditorErrorBoundary><EditTab /></EditorErrorBoundary>
        </div>
        <div role="tabpanel" id="editor-panel-design" aria-labelledby="editor-tab-design" className={activeTab === 'design' ? 'block' : 'hidden'}>
          <EditorErrorBoundary><DesignPanel /></EditorErrorBoundary>
        </div>
        <div role="tabpanel" id="editor-panel-ats" aria-labelledby="editor-tab-ats" className={activeTab === 'ats' ? 'block' : 'hidden'}>
          <EditorErrorBoundary><AtsScorePanel /></EditorErrorBoundary>
        </div>
        <div role="tabpanel" id="editor-panel-coverLetter" aria-labelledby="editor-tab-coverLetter" className={activeTab === 'coverLetter' ? 'block' : 'hidden'}>
          <EditorErrorBoundary><CoverLetterPanel /></EditorErrorBoundary>
        </div>
      </div>
    </>
  )

  // `showExpandToggle` is only offered on desktop — on mobile, the
  // Edit/Preview switcher already gives the preview the full screen.
  function renderPreviewPanelBody(showExpandToggle: boolean) {
    return (
      <>
        <div className="flex items-center gap-2 px-3 h-12 border-b border-indigo-100 bg-white/50 shrink-0">
          <span className="text-xs font-medium text-fg-muted flex-1">Live Preview</span>
          {showExpandToggle && (
            <button
              onClick={() => setPreviewExpanded((v) => !v)}
              title={previewExpanded ? 'Collapse preview' : 'Expand preview'}
              aria-label={previewExpanded ? 'Collapse preview' : 'Expand preview'}
              className={`flex items-center justify-center min-h-[40px] min-w-[40px] text-sm border rounded px-2 py-1 transition-colors ${
                previewExpanded
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-indigo-200 text-fg-muted hover:bg-indigo-50'
              }`}
            >
              ⛶
            </button>
          )}
        </div>
        <div className="flex-1 overflow-hidden flex flex-col">
          <EditorErrorBoundary><PreviewTab interactive={!previewExpanded} /></EditorErrorBoundary>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50">
      {/*
        The editor was the only route in the app without an h1 — every other
        page has one ("My CVs", "Applications", "Job Search Profiles") — so a
        screen reader listing headings here found nothing to orient by.

        Visually hidden rather than drawn, because the résumé's name is already
        on screen as an editable input in the panel below, and rendering it
        twice would be redundant to sighted users. The input keeps its own
        `aria-label`; this names the page, not the field.
      */}
      <h1 className="sr-only">{storeTitle ? `Editing ${storeTitle}` : 'CV editor'}</h1>

      {/* Top navbar */}
      <AppNavbar
        actions={
          <div className="flex flex-1 flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              onClick={handleLeaveEditor}
              aria-busy={isLeaving}
              className="mr-auto text-lg font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              ← My CVs
            </Link>
            <span className="text-indigo-200">|</span>
            <span
              role="status"
              aria-live="polite"
              className={`text-xs ${saveError ? 'text-fg-danger' : 'text-fg-muted'}`}
            >
              {saveError ?? saveStatus}
            </span>
            <div className="w-px h-4 bg-indigo-200 mx-1" />
            <button
              onClick={handleJsonExport}
              className="flex items-center justify-center min-h-[40px] text-xs border border-indigo-200 text-indigo-600 rounded-lg px-3 hover:bg-indigo-50 hover:shadow-sm transition-all"
            >
              JSON
            </button>
            <ExportMenu onExport={handleExport} busy={isExporting} />
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
        {isMobile ? (
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            {/* Edit/Preview switcher — replaces the side-by-side layout below the breakpoint */}
            <div
              role="tablist"
              aria-label="View"
              onKeyDown={handleTablistKeyDown}
              className="flex gap-1 p-1 border-b border-indigo-100 bg-white/50 shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileView === 'edit'}
                tabIndex={tabIndexFor(mobileView === 'edit')}
                onClick={() => setMobileView('edit')}
                className={`flex-1 min-h-[40px] rounded text-sm font-medium transition-colors ${
                  mobileView === 'edit'
                    ? 'bg-indigo-600 text-white'
                    : 'text-fg-muted hover:bg-indigo-50'
                }`}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mobileView === 'preview'}
                tabIndex={tabIndexFor(mobileView === 'preview')}
                onClick={() => setMobileView('preview')}
                className={`flex-1 min-h-[40px] rounded text-sm font-medium transition-colors ${
                  mobileView === 'preview'
                    ? 'bg-indigo-600 text-white'
                    : 'text-fg-muted hover:bg-indigo-50'
                }`}
              >
                Preview
              </button>
            </div>

            {mobileView === 'edit' ? (
              <div className="flex flex-col flex-1 min-w-0 bg-white/40 backdrop-blur-xl overflow-hidden">
                {editPanelBody}
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-w-0 bg-white/30 backdrop-blur-sm overflow-hidden">
                {renderPreviewPanelBody(false)}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Left panel */}
            {previewExpanded ? (
              <div className="w-9 min-w-[36px] bg-indigo-900 flex flex-col items-center py-3 gap-4 border-r border-indigo-800 shrink-0">
                {(['edit', 'design', 'ats', 'coverLetter'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setPreviewExpanded(false); setActiveTab(tab) }}
                    // Deliberately still a raw indigo-300, not the fg-subtle
                    // token every other muted label moved to. This rail is
                    // bg-indigo-900, so this is light-on-dark: indigo-300
                    // measures 5.73:1 here and already clears AA, while the
                    // token (a dark grey tuned for light surfaces) would be
                    // near-invisible. Do not "fix" it to match its siblings.
                    className="text-xs text-indigo-300 hover:text-white transition-colors"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
            ) : (
              <div
                className="flex flex-col border-r border-white/30 bg-white/50 backdrop-blur-xl shadow-md shrink-0"
                style={{ width: panelWidth }}
              >
                {editPanelBody}
              </div>
            )}

            {/* Resize divider — only when panel is not collapsed */}
            {!previewExpanded && (
              <div
                data-testid="panel-resize-divider"
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize editor panel"
                aria-valuenow={panelWidth}
                aria-valuemin={mounted ? getPanelWidthBounds().min : DEFAULT_PANEL_WIDTH}
                aria-valuemax={mounted ? getPanelWidthBounds().max : DEFAULT_PANEL_WIDTH}
                tabIndex={0}
                className={`group/divider w-1.5 shrink-0 cursor-col-resize select-none transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                  dividerActive ? 'bg-indigo-400/60' : 'hover:bg-indigo-400/40 bg-indigo-200/30'
                }`}
                onPointerDown={handleDividerPointerDown}
                onPointerMove={handleDividerPointerMove}
                onPointerUp={handleDividerPointerUp}
                onPointerCancel={handleDividerPointerCancel}
                onKeyDown={handleDividerKeyDown}
              />
            )}

            {/* Right panel — preview */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-100/60">
              {renderPreviewPanelBody(true)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
