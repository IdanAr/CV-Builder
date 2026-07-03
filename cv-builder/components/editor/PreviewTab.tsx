'use client'

import { useRef, useEffect, useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useDebounce } from '@/lib/hooks/use-debounce'
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

  const containerRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0.75)
  const [templateHeight, setTemplateHeight] = useState(A4_HEIGHT_PX)

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

  const pageBreaks = computePageBreaks(templateHeight, debouncedMeta.pageMargins * 96)

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-white/20 backdrop-blur-sm flex justify-center py-8"
    >
      {/* Outer wrapper sized to post-scale visual dimensions so the scroll container tracks content correctly */}
      <div
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

        {/* Page break indicators */}
        {pageBreaks.map(({ page, top }) => (
          <div
            key={page}
            style={{
              position: 'absolute',
              top: top * fitScale,
              left: 0,
              right: 0,
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <div
              style={{
                borderTop: '2px dashed rgba(99, 102, 241, 0.4)',
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
                Page {page + 1}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
