'use client'

import { useRef, useEffect, useState } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const TEMPLATES: Record<string, React.ComponentType<{ data: ResumeData; meta: ResumeMeta }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
}

export function PreviewTab() {
  const data = useResumeEditorStore((s) => s.data)
  const meta = useResumeEditorStore((s) => s.meta)
  const debouncedData = useDebounce(data, 300)
  const debouncedMeta = useDebounce(meta, 300)
  const containerRef = useRef<HTMLDivElement>(null)
  const [fitScale, setFitScale] = useState(0.75)

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setFitScale(Math.min(1, (containerRef.current.clientWidth - 64) / 794))
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const Template = TEMPLATES[debouncedMeta.templateId] ?? ClassicTemplate

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-white/20 backdrop-blur-sm flex justify-center py-8">
      <div style={{ transform: `scale(${fitScale})`, transformOrigin: 'top center' }}>
        <Template data={debouncedData} meta={debouncedMeta} />
      </div>
    </div>
  )
}
