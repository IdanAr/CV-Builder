'use client'

import { useRef, useEffect, useLayoutEffect, useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { usePdfPagination } from '@/lib/hooks/use-pdf-pagination'
import { resolveAnchorTops, type ResolvedBreak } from '@/lib/preview-anchor'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import { ExecutiveTemplate } from '@/components/templates/ExecutiveTemplate'
import { SidebarTemplate } from '@/components/templates/SidebarTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import { computePageBreaks, A4_WIDTH_PX, A4_HEIGHT_PX } from '@/lib/preview-pagination'

const TEMPLATES: Record<string, React.ComponentType<{ data: ResumeData; meta: ResumeMeta }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  executive: ExecutiveTemplate,
  sidebar: SidebarTemplate,
}

const ZOOM_STORAGE_KEY = 'cv-builder:preview-zoom'
const MIN_ZOOM = 0.25
const MAX_ZOOM = 2.0
const ZOOM_STEP = 0.1
const ZOOM_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5]

function clampZoom(z: number): number {
  return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) * 100) / 100
}

export function PreviewTab() {
  const data = useResumeEditorStore((s) => s.data)
  const meta = useResumeEditorStore((s) => s.meta)
  const debouncedData = useDebounce(data, 300)
  const debouncedMeta = useDebounce(meta, 300)
  const pagination = usePdfPagination(data, meta)

  const containerRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0.75)
  const [templateHeight, setTemplateHeight] = useState(A4_HEIGHT_PX)
  const [breaks, setBreaks] = useState<ResolvedBreak[]>([])
  // null = auto-fit (tracks fitScale via the ResizeObserver below); a number
  // is a user-set override that takes precedence everywhere fitScale is used.
  const [zoomOverride, setZoomOverride] = useState<number | null>(null)
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false)

  // Track container width → fitScale
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setFitScale(Math.min(1, (el.clientWidth - 64) / A4_WIDTH_PX))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Restore a previously-persisted zoom level. Absent or 'fit' → leave
  // zoomOverride at its default null so first-time users get auto-fit.
  useEffect(() => {
    const saved = localStorage.getItem(ZOOM_STORAGE_KEY)
    if (saved && saved !== 'fit') {
      const z = parseFloat(saved)
      if (!isNaN(z)) setZoomOverride(clampZoom(z))
    }
  }, [])

  // Track rendered template height
  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setTemplateHeight(el.scrollHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const Template = TEMPLATES[debouncedMeta.templateId] ?? ClassicTemplate

  // Effective scale used everywhere fitScale was previously referenced: a
  // user zoom override wins over the auto-fit scale when set.
  const scale = zoomOverride ?? fitScale

  const marginPx = debouncedMeta.pageMargins * 96
  const usablePx = A4_HEIGHT_PX - 2 * marginPx
  const estimates = computePageBreaks(templateHeight, marginPx)
  const estimatedPageCount = estimates.length + 1

  function handleZoomIn() {
    applyZoom(clampZoom((zoomOverride ?? fitScale) + ZOOM_STEP))
  }

  function handleZoomOut() {
    applyZoom(clampZoom((zoomOverride ?? fitScale) - ZOOM_STEP))
  }

  function applyZoom(z: number | null) {
    setZoomOverride(z)
    localStorage.setItem(ZOOM_STORAGE_KEY, z === null ? 'fit' : String(z))
  }

  function handlePresetSelect(z: number | null) {
    applyZoom(z)
    setZoomMenuOpen(false)
  }

  // Resolve divider positions after the DOM has the debounced content.
  // Synced → pin to PDF anchor lines (estimate fallback per break inside
  // resolveAnchorTops). Otherwise → margin-aware estimates.
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const content = innerRef.current
    if (!wrapper || !content) return
    if (pagination.status === 'synced') {
      setBreaks(
        resolveAnchorTops(wrapper, content, {
          anchors: pagination.anchors,
          estimateTopFor: (k) => (marginPx + (k + 1) * usablePx) * scale,
          maxTop: templateHeight * scale,
        })
      )
    } else {
      setBreaks(
        estimates.map((b) => ({ page: b.page, top: b.top * scale, source: 'estimate' as const }))
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.status, pagination.anchors, templateHeight, scale, debouncedData, debouncedMeta])

  const badgeText =
    pagination.status === 'synced' && pagination.pageCount !== null
      ? `${pagination.pageCount} page${pagination.pageCount === 1 ? '' : 's'} · matches PDF`
      : pagination.status === 'error'
        ? `${estimatedPageCount} page${estimatedPageCount === 1 ? '' : 's'} (estimated)`
        : 'Calculating pages…'

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="relative flex-1 min-h-0">
        {/* Pagination status badge — floats over the preview, does not scroll */}
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 16,
            zIndex: 20,
            background: 'rgba(99, 102, 241, 0.10)',
            color: 'rgba(67, 56, 202, 0.9)',
            fontSize: '11px',
            padding: '3px 10px',
            borderRadius: '9999px',
            fontFamily: 'sans-serif',
            userSelect: 'none',
            pointerEvents: 'none',
            backdropFilter: 'blur(4px)',
          }}
        >
          {badgeText}
        </div>

        {/* Floating zoom toolbar — overlays the preview */}
        <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-full bg-white/85 backdrop-blur-md shadow-lg ring-1 ring-indigo-100 px-2 py-1.5">
          <button
            type="button"
            aria-label="Zoom out"
            data-testid="zoom-out"
            onClick={handleZoomOut}
            disabled={scale <= MIN_ZOOM}
            className="flex items-center justify-center min-h-[28px] min-w-[28px] text-sm rounded-full text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            −
          </button>
          <div className="relative">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={zoomMenuOpen}
              data-testid="zoom-percentage"
              onClick={() => setZoomMenuOpen((v) => !v)}
              className="flex items-center justify-center min-h-[28px] px-2 text-xs rounded-full text-indigo-600 hover:bg-indigo-50 transition-colors tabular-nums"
            >
              {zoomOverride === null ? 'Fit' : `${Math.round(zoomOverride * 100)}%`}
            </button>
            {zoomMenuOpen && (
              <div
                role="listbox"
                data-testid="zoom-menu"
                className="absolute right-0 bottom-full mb-1 z-30 bg-white border border-indigo-200 rounded shadow-md py-1 min-w-[80px]"
              >
                {ZOOM_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={zoomOverride === p}
                    onClick={() => handlePresetSelect(p)}
                    className="block w-full text-left px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50"
                  >
                    {Math.round(p * 100)}%
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected={zoomOverride === null}
                  onClick={() => handlePresetSelect(null)}
                  className="block w-full text-left px-3 py-1 text-xs text-indigo-600 hover:bg-indigo-50 border-t border-indigo-100"
                >
                  Fit
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label="Zoom in"
            data-testid="zoom-in"
            onClick={handleZoomIn}
            disabled={scale >= MAX_ZOOM}
            className="flex items-center justify-center min-h-[28px] min-w-[28px] text-sm rounded-full text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        <div
          ref={containerRef}
          className="h-full overflow-auto bg-slate-200/60 flex justify-center py-10"
        >
          {/* Outer wrapper sized to post-scale visual dimensions so the scroll container tracks content correctly */}
          <div
            ref={wrapperRef}
            className="shadow-2xl ring-1 ring-gray-900/10 bg-white"
            style={{
              position: 'relative',
              width: A4_WIDTH_PX * scale,
              height: templateHeight * scale,
              flexShrink: 0,
            }}
          >
            {/* Inner div absolutely positioned and CSS-scaled — transform does not affect layout flow */}
            <div
              ref={innerRef}
              data-testid="preview-scaled-content"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: A4_WIDTH_PX,
                transformOrigin: 'top left',
                transform: `scale(${scale})`,
              }}
            >
              <Template data={debouncedData} meta={debouncedMeta} />
            </div>

          {/* Page break indicators — solid when pinned to real PDF breaks, dashed while estimating */}
          {breaks.map(({ page, top, source }) => (
            <div
              key={page}
              style={{
                position: 'absolute',
                top,
                left: 0,
                right: 0,
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  borderTop:
                    source === 'pdf'
                      ? '2px solid rgba(99, 102, 241, 0.55)'
                      : '2px dashed rgba(99, 102, 241, 0.4)',
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    background: 'rgba(99, 102, 241, 0.08)',
                    color: 'rgba(99, 102, 241, 0.6)',
                    fontSize: '10px',
                    padding: '1px 8px',
                    borderRadius: '0 0 4px 4px',
                    fontFamily: 'sans-serif',
                    userSelect: 'none',
                  }}
                >
                  {source === 'pdf' ? `Page ${page + 1}` : `≈ Page ${page + 1}`}
                </span>
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>
    </div>
  )
}
