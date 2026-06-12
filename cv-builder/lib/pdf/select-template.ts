import React from 'react'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'
import type { ExportMode } from '@/lib/export-mode'
import { ClassicPdfTemplate } from './templates/ClassicPdfTemplate'
import { ModernPdfTemplate } from './templates/ModernPdfTemplate'
import { MinimalPdfTemplate } from './templates/MinimalPdfTemplate'
import { ExecutivePdfTemplate } from './templates/ExecutivePdfTemplate'
import { SidebarPdfTemplate } from './templates/SidebarPdfTemplate'
import { AtsPdfTemplate } from './templates/AtsPdfTemplate'

export function selectPdfTemplate(
  data: ResumeData,
  meta: ResumeMeta,
  mode: ExportMode,
  title?: string
): React.ReactElement {
  if (mode === 'ats') return React.createElement(AtsPdfTemplate, { data, meta, title })
  switch (meta.templateId) {
    case 'modern':
      return React.createElement(ModernPdfTemplate, { data, meta, title })
    case 'minimal':
      return React.createElement(MinimalPdfTemplate, { data, meta, title })
    case 'executive':
      return React.createElement(ExecutivePdfTemplate, { data, meta, title })
    case 'sidebar':
      return React.createElement(SidebarPdfTemplate, { data, meta, title })
    default:
      return React.createElement(ClassicPdfTemplate, { data, meta, title })
  }
}
