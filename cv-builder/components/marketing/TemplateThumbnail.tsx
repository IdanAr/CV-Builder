import { A4_WIDTH_PX, A4_HEIGHT_PX } from '@/lib/preview-pagination'
import { SAMPLE_RESUME_DATA, sampleResumeMeta } from '@/lib/marketing/sample-resume'
import { ClassicTemplate } from '@/components/templates/ClassicTemplate'
import { MinimalTemplate } from '@/components/templates/MinimalTemplate'
import { ModernTemplate } from '@/components/templates/ModernTemplate'
import { ExecutiveTemplate } from '@/components/templates/ExecutiveTemplate'
import { SidebarTemplate } from '@/components/templates/SidebarTemplate'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

export type MarketingTemplateId = 'classic' | 'minimal' | 'modern' | 'executive' | 'sidebar'

const TEMPLATES: Record<MarketingTemplateId, React.ComponentType<{ data: ResumeData; meta: ResumeMeta }>> = {
  classic: ClassicTemplate,
  minimal: MinimalTemplate,
  modern: ModernTemplate,
  executive: ExecutiveTemplate,
  sidebar: SidebarTemplate,
}

const TEMPLATE_LABELS: Record<MarketingTemplateId, string> = {
  classic: 'Classic',
  minimal: 'Minimal',
  modern: 'Modern',
  executive: 'Executive',
  sidebar: 'Sidebar',
}

interface TemplateThumbnailProps {
  templateId: MarketingTemplateId
  /** Visible height of the clipped preview, in px. Defaults to a portrait card. */
  height?: number
  className?: string
  'data-testid'?: string
  /** Overrides the sample meta's default (schema-default black/blue) colors. */
  colors?: { primaryColor: string; accentColor: string }
  /**
   * Whether this thumbnail is purely illustrative (e.g. a background visual next to
   * real headline text) vs. the primary content the user came to see (e.g. a
   * templates gallery). Decorative thumbnails are hidden from assistive tech via
   * `aria-hidden`/`inert`; non-decorative ones get a descriptive `aria-label`
   * instead. Defaults to `true` to preserve existing decorative call sites.
   */
  decorative?: boolean
}

/**
 * Renders a real template component at full design width (A4_WIDTH_PX) and
 * scales it down with a CSS transform, then clips it to `height` — the same
 * technique PreviewTab.tsx uses for the live editor, minus pagination/zoom
 * controls (this is a static marketing thumbnail, not an editable preview).
 */
export function TemplateThumbnail({
  templateId,
  height = 420,
  className = '',
  'data-testid': testId,
  colors,
  decorative = true,
}: TemplateThumbnailProps) {
  const Template = TEMPLATES[templateId]
  const meta = { ...sampleResumeMeta(templateId), ...colors }
  // Scale the full A4-width template down so its full A4 height maps to the
  // requested card height, then derive the card's width from that same scale
  // so the card keeps the real A4 aspect ratio (794 x 1123).
  const scale = height / A4_HEIGHT_PX
  const width = A4_WIDTH_PX * scale

  return (
    <div
      data-testid={testId}
      className={`relative overflow-hidden rounded-lg bg-white shadow-lg ${className}`}
      style={{ height, width }}
      {...(decorative
        ? { 'aria-hidden': 'true' as const, inert: true }
        : { 'aria-label': `${TEMPLATE_LABELS[templateId]} template preview` })}
    >
      <div
        style={{
          width: A4_WIDTH_PX,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        <Template data={SAMPLE_RESUME_DATA} meta={meta} />
      </div>
    </div>
  )
}
