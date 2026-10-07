'use client'

import { memo } from 'react'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import { ExecutiveTemplate } from '@/components/templates/ExecutiveTemplate'
import { SidebarTemplate } from '@/components/templates/SidebarTemplate'
import { ResumeMetaSchema, type ResumeData, type ResumeMeta } from '@/lib/schemas/resume.zod'
import { A4_WIDTH_PX } from '@/lib/preview-pagination'

// Same lookup as the editor's PreviewTab, so a thumbnail is the real page.
const TEMPLATES: Record<string, React.ComponentType<{ data: ResumeData; meta: ResumeMeta }>> = {
  classic: ClassicTemplate,
  modern: ModernTemplate,
  minimal: MinimalTemplate,
  executive: ExecutiveTemplate,
  sidebar: SidebarTemplate,
}

export const THUMBNAIL_SCALE = 0.24

const META_DEFAULTS = ResumeMetaSchema.parse({})

/**
 * A static, small-scale render of a CV's first page using the same preview
 * template the editor shows. The templates are pure `{ data, meta }`
 * components with no store or browser dependency, so they render here as is.
 *
 * The page is laid out at its true A4 width (the templates fix it at 794px)
 * and scaled down, then centred in a soft gray frame. The page itself stays
 * white whatever the theme, because it is a picture of paper.
 *
 * `inert` plus `aria-hidden`: the templates contain real mailto/profile
 * links, and a decorative picture must not add tab stops or announce a
 * second copy of the CV to a screen reader.
 */
function CvThumbnailImpl({
  data,
  meta,
  scale = THUMBNAIL_SCALE,
}: {
  data: unknown
  meta: unknown
  scale?: number
}) {
  const scaledWidth = A4_WIDTH_PX * scale
  // Older documents can predate newer meta fields; fill them from the schema
  // defaults rather than letting a template read `undefined`.
  const fullMeta = { ...META_DEFAULTS, ...((meta ?? {}) as Partial<ResumeMeta>) } as ResumeMeta
  const Template = TEMPLATES[fullMeta.templateId] ?? ClassicTemplate

  return (
    <div className="relative h-[140px] overflow-hidden rounded-control border border-border bg-surface-muted">
      <div aria-hidden="true" inert className="pointer-events-none select-none">
        <div
          data-testid="cv-thumbnail-page"
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            marginLeft: -scaledWidth / 2,
            width: A4_WIDTH_PX,
            // Intentional token exception: CV paper is always white, in every theme.
            background: '#fff',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <Template data={(data ?? {}) as ResumeData} meta={fullMeta} />
        </div>
      </div>
    </div>
  )
}

// Rows re-render on sort and view changes; the page render is the expensive
// part and only depends on these two props.
export const CvThumbnail = memo(CvThumbnailImpl)
