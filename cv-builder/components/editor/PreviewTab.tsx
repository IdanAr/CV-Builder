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

  const marginPx = debouncedMeta.pageMargins * 96
  const usablePx = A4_HEIGHT_PX - 2 * marginPx
  const estimates = computePageBreaks(templateHeight, marginPx)
  const estimatedPageCount = estimates.length + 1

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
          estimateTopFor: (k) => (marginPx + (k + 1) * usablePx) * fitScale,
          maxTop: templateHeight * fitScale,
        })
      )
    } else {
      setBreaks(
        estimates.map((b) => ({ page: b.page, top: b.top * fitScale, source: 'estimate' as const }))
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.status, pagination.anchors, templateHeight, fitScale, debouncedData, debouncedMeta])

  const badgeText =
    pagination.status === 'synced' && pagination.pageCount !== null
      ? `${pagination.pageCount} page${pagination.pageCount === 1 ? '' : 's'} · matches PDF`
      : pagination.status === 'error'
        ? `${estimatedPageCount} page${estimatedPageCount === 1 ? '' : 's'} (estimated)`
        : 'Calculating pages…'

  return (
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

      <div
        ref={containerRef}
        className="h-full overflow-auto bg-white/20 backdrop-blur-sm flex justify-center py-8"
      >
        {/* Outer wrapper sized to post-scale visual dimensions so the scroll container tracks content correctly */}
        <div
          ref={wrapperRef}
          style={{
            position: 'relative',
            width: A4_WIDTH_PX * fitScale,
            height: templateHeight * fitScale,
            flexShrink: 0,
          }}
        >
          {/* Inner div absolutely positioned and CSS-scaled — transform does not affect layout flow */}
          <div
            ref={innerRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: A4_WIDTH_PX,
              transformOrigin: 'top left',
              transform: `scale(${fitScale})`,
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
  )
}
