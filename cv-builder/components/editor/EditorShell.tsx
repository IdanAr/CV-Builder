'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'framer-motion'
import { FileText, Gauge, Mail, Palette, type LucideIcon } from 'lucide-react'
import { handleTablistKeyDown, tabIndexFor } from '@/lib/tablist-keys'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useResumeEditorStore, initAutoSave, flushSave } from '@/lib/stores/resume-editor.store'
import { EditTab } from './EditTab'
import { PreviewTab } from './PreviewTab'
import { DesignPanel } from './DesignPanel'
import { AtsScorePanel } from '@/components/ats/AtsScorePanel'
import { CoverLetterPanel } from '@/components/coverletter/CoverLetterPanel'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { EditorTopBar } from './EditorTopBar'
import { toast } from '@/lib/stores/toast.store'
import type { ExportMode } from '@/lib/export-mode'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { apiErrorMessage } from '@/lib/api/client-errors'
import { requestErrorMessage } from '@/lib/fetch-with-timeout'

type Tab = 'edit' | 'design' | 'ats' | 'coverLetter'

const TAB_LABELS: Record<Tab, string> = { edit: 'Edit', design: 'Design', ats: 'ATS', coverLetter: 'Cover Letter' }
const TAB_ICONS: Record<Tab, LucideIcon> = { edit: FileText, design: Palette, ats: Gauge, coverLetter: Mail }

const PANEL_WIDTH_KEY = 'cv-builder:panel-width'
const PANEL_MIN = 320
const PANEL_MAX = 480
const DEFAULT_PANEL_WIDTH = 380

// Below this width, the resizable side-by-side layout is replaced by a
// single full-width panel with an Edit/Preview switcher (matches Tailwind's `md`).
const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)'

type MobileView = 'edit' | 'preview'

/** The effective min/max a panel width can be clamped to, given the current viewport. */
function getPanelWidthBounds(): { min: number; max: number } {
  // Safety check for Next.js SSR
  if (typeof window === 'undefined') return { min: PANEL_MIN, max: PANEL_MAX }

  // Never wider than the screen on tiny viewports; never above 60% of the
  // screen or PANEL_MAX, but never below the minimum either.
  const min = Math.min(PANEL_MIN, window.innerWidth)
  const max = Math.min(PANEL_MAX, Math.max(min, Math.floor(window.innerWidth * 0.6)))

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
}

export function EditorShell({ resumeId, title, data, meta }: EditorShellProps) {
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
  const panelRef = useRef<HTMLDivElement>(null)
  // The panel's left edge in viewport coordinates (the app shell's sidebar rail sits to its left).
  const dragOffsetRef = useRef(0)
  // The width the user last chose. The window resize handler clamps this for the
  // current viewport rather than the rendered width, so growing the window back
  // restores it instead of keeping the shrunken value.
  const preferredWidthRef = useRef(DEFAULT_PANEL_WIDTH)
  // The preference as it was at pointer-down, so a cancelled drag can restore it, and whether
  // the pointer actually moved (a plain click must not overwrite the preference).
  const preferredAtDragStartRef = useRef(DEFAULT_PANEL_WIDTH)
  const dragMovedRef = useRef(false)
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT_QUERY)
  const reduceMotion = useReducedMotion()

  const storeTitle = useResumeEditorStore((s) => s.title)
  const isDirty = useResumeEditorStore((s) => s.isDirty)
  const router = useRouter()
  const [isExporting, setIsExporting] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)
  const saveError = useResumeEditorStore((s) => s.saveError)
  const hydrate = useResumeEditorStore((s) => s.hydrate)
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
        // Keep the stored value (bounded only by the panel's own limits) as the preference and
        // render it clamped to this viewport, so a window that grows later restores it.
        preferredWidthRef.current = Math.max(PANEL_MIN, Math.min(PANEL_MAX, w))
        setPanelWidth(clampPanelWidth(preferredWidthRef.current))
      }
    }
  }, [])

  useEffect(() => {
    function onResize() {
      setPanelWidth(clampPanelWidth(preferredWidthRef.current))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function handleDividerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    preferredAtDragStartRef.current = preferredWidthRef.current
    dragMovedRef.current = false
    dragOffsetRef.current = panelRef.current?.getBoundingClientRect().left ?? 0
    e.currentTarget.setPointerCapture(e.pointerId)
    draggingRef.current = true
    setDividerActive(true)
  }

  function handleDividerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return
    const next = clampPanelWidth(e.clientX - dragOffsetRef.current)
    dragMovedRef.current = true
    preferredWidthRef.current = next
    setPanelWidth(next)
  }

  function handleDividerPointerUp() {
    draggingRef.current = false
    setDividerActive(false)
    if (!dragMovedRef.current) return
    localStorage.setItem(PANEL_WIDTH_KEY, String(preferredWidthRef.current))
  }

  function handleDividerPointerCancel() {
    draggingRef.current = false
    setDividerActive(false)
    preferredWidthRef.current = preferredAtDragStartRef.current
    setPanelWidth(clampPanelWidth(preferredAtDragStartRef.current))
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
      preferredWidthRef.current = next
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
      // Exports share the 10 req/min limiter with the AI routes, and a user
      // iterating on a résumé hits it easily. Discarding the body here meant the
      // catch below reported "export failed" for throttling, a bad request and a
      // crashed renderer alike.
      if (!res.ok) throw new Error(await apiErrorMessage(res, `${format.toUpperCase()} export failed. Please try again.`))
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
    } catch (err) {
      toast.error(requestErrorMessage(err, `${format.toUpperCase()} export failed. Please try again.`))
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
      router.push('/dashboard/cvs')
    } catch {
      if (window.confirm("Your latest changes couldn't be saved. Leave anyway and lose them?")) {
        router.push('/dashboard/cvs')
      }
    } finally {
      setIsLeaving(false)
    }
  }

  // Shared between the desktop side-by-side layout and the mobile
  // single-panel view — the editor panel's contents never change,
  // only how much of the screen it occupies.
  const editPanelBody = (
    <>
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Editor sections"
        onKeyDown={handleTablistKeyDown}
        className="flex border-b border-border shrink-0 bg-surface"
      >
        {(['edit', 'design', 'ats', 'coverLetter'] as Tab[]).map((tab) => {
          const Icon = TAB_ICONS[tab]
          return (
          <button
            key={tab}
            type="button"
            role="tab"
            id={`editor-tab-${tab}`}
            aria-controls={`editor-panel-${tab}`}
            aria-selected={activeTab === tab}
            tabIndex={tabIndexFor(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
            className={`relative flex flex-auto items-center justify-center gap-1.5 min-h-[44px] px-2 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
              activeTab === tab ? 'text-fg-heading' : 'text-fg-muted hover:text-fg-body'
            }`}
          >
            <Icon aria-hidden="true" className={`h-4 w-4 shrink-0 ${activeTab === tab ? 'text-primary' : ''}`} />
            <span className="whitespace-nowrap">{TAB_LABELS[tab]}</span>
            {activeTab === tab && (
              <motion.span
                layoutId="editor-tab-underline"
                className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
              />
            )}
          </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        <div role="tabpanel" id="editor-panel-edit" aria-labelledby="editor-tab-edit" className={activeTab === 'edit' ? 'block' : 'hidden'}>
          <EditorErrorBoundary><EditTab /></EditorErrorBoundary>
        </div>
        <div role="tabpanel" id="editor-panel-design" aria-labelledby="editor-tab-design" className={activeTab === 'design' ? 'block' : 'hidden'}>
          <EditorErrorBoundary><DesignPanel active={activeTab === 'design'} /></EditorErrorBoundary>
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
        <div className="flex-1 overflow-hidden flex flex-col">
          <EditorErrorBoundary><PreviewTab
              interactive={!previewExpanded}
              expandable={showExpandToggle}
              expanded={previewExpanded}
              onToggleExpand={() => setPreviewExpanded((v) => !v)}
            /></EditorErrorBoundary>
        </div>
      </>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-surface-page">
      {/*
        The editor was the only route in the app without an h1 — every other
        page has one ("My CVs", "Applications", "Job Search Profiles") — so a
        screen reader listing headings here found nothing to orient by.

        Visually hidden rather than drawn, because the résumé's name is already
        on screen as an editable input in the top bar, and rendering it
        twice would be redundant to sighted users. The input keeps its own
        `aria-label`; this names the page, not the field.
      */}
      <h1 className="sr-only">{storeTitle ? `Editing ${storeTitle}` : 'CV editor'}</h1>

      <EditorTopBar
        onLeave={handleLeaveEditor}
        onExport={handleExport}
        onJsonExport={handleJsonExport}
        exporting={isExporting}
        leaving={isLeaving}
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
              className="flex gap-1 p-1 border-b border-border bg-surface shrink-0"
            >
              <button
                type="button"
                role="tab"
                aria-selected={mobileView === 'edit'}
                tabIndex={tabIndexFor(mobileView === 'edit')}
                onClick={() => setMobileView('edit')}
                className={`flex-1 min-h-[40px] rounded-control text-sm font-medium transition-colors ${
                  mobileView === 'edit'
                    ? 'bg-primary text-primary-fg'
                    : 'text-fg-muted hover:bg-surface-subtle'
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
                className={`flex-1 min-h-[40px] rounded-control text-sm font-medium transition-colors ${
                  mobileView === 'preview'
                    ? 'bg-primary text-primary-fg'
                    : 'text-fg-muted hover:bg-surface-subtle'
                }`}
              >
                Preview
              </button>
            </div>

            {mobileView === 'edit' ? (
              <div className="flex flex-col flex-1 min-w-0 bg-surface overflow-hidden">
                {editPanelBody}
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-w-0 bg-surface overflow-hidden">
                {renderPreviewPanelBody(false)}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Left panel */}
            {previewExpanded ? (
              <div className="w-9 min-w-[36px] bg-surface-subtle flex flex-col items-center py-3 gap-4 border-r border-border shrink-0">
                {(['edit', 'design', 'ats', 'coverLetter'] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setPreviewExpanded(false); setActiveTab(tab) }}
                    className="text-xs text-fg-muted hover:text-fg transition-colors rounded-chip focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                  >
                    {TAB_LABELS[tab]}
                  </button>
                ))}
              </div>
            ) : (
              <div
                ref={panelRef}
                className="flex flex-col border-r border-border bg-surface shrink-0"
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
                aria-valuemin={mounted ? getPanelWidthBounds().min : PANEL_MIN}
                aria-valuemax={mounted ? getPanelWidthBounds().max : PANEL_MAX}
                tabIndex={0}
                className={`group/divider w-1.5 shrink-0 cursor-col-resize select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  dividerActive ? 'bg-ring/60' : 'bg-border hover:bg-ring/40'
                }`}
                onPointerDown={handleDividerPointerDown}
                onPointerMove={handleDividerPointerMove}
                onPointerUp={handleDividerPointerUp}
                onPointerCancel={handleDividerPointerCancel}
                onKeyDown={handleDividerKeyDown}
              />
            )}

            {/* Right panel — preview */}
            <div className="flex-1 flex flex-col min-w-0 bg-surface-muted">
              {renderPreviewPanelBody(true)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
