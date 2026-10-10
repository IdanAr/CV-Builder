'use client'

import { useState } from 'react'
import { Columns2, Palette, Ruler, Type } from 'lucide-react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { matchColorTheme } from '@/lib/editor/color-themes'
import { matchPairing } from '@/lib/fonts/pairings'
import { DEFAULT_PICKER_FONT } from '@/lib/fonts/families'
import { TemplateGrid } from './design/TemplateGrid'
import { ColumnsSection, layoutSummary } from './design/ColumnsSection'
import { FontSection } from './design/FontSection'
import { ColorSection, ThemeDot } from './design/ColorSection'
import { SpacingControls, spacingSummary } from './design/SpacingControls'
import { InspectorSection } from './design/InspectorSection'

type SectionId = 'colors' | 'typography' | 'layout' | 'spacing'

/**
 * `active` is false while the Design tab is hidden (EditorShell keeps all tab
 * panels mounted); it stops the template thumbnails doing work on every edit.
 *
 * Layout: the template gallery is always on screen, everything else sits in
 * collapsible rows that show their current value when closed. Only one row is
 * open at a time, so the panel never grows into a long scroll.
 */
export function DesignPanel({ active = true }: { active?: boolean }) {
  const meta = useResumeEditorStore((s) => s.meta)
  const [open, setOpen] = useState<SectionId | null>(null)
  const toggle = (id: SectionId) => setOpen((cur) => (cur === id ? null : id))

  const theme = matchColorTheme(meta.primaryColor, meta.accentColor)
  const heading = meta.headerFontFamily ?? DEFAULT_PICKER_FONT
  const pairing = matchPairing(heading, meta.fontFamily)

  return (
    <div className="mx-auto max-w-md space-y-5 px-4 py-5">
      <section aria-labelledby="design-template">
        <div className="mb-2.5 flex items-baseline justify-between">
          <h2 id="design-template" className="text-sm font-medium text-fg-heading">Template</h2>
          <span className="text-xs text-fg-subtle">Your content, five looks</span>
        </div>
        <TemplateGrid active={active} />
      </section>

      <div className="space-y-2">
        <InspectorSection
          title="Colors"
          icon={<Palette className="h-4 w-4" />}
          summary={
            <span className="inline-flex items-center gap-1.5">
              <ThemeDot primary={meta.primaryColor} accent={meta.accentColor} className="h-3 w-3" />
              {theme ? theme.label : 'Custom'}
            </span>
          }
          open={open === 'colors'}
          onToggle={() => toggle('colors')}
        >
          <ColorSection />
        </InspectorSection>

        <InspectorSection
          title="Typography"
          icon={<Type className="h-4 w-4" />}
          summary={`${pairing ? pairing.label : 'Custom'} · ${heading} / ${meta.fontFamily}`}
          open={open === 'typography'}
          onToggle={() => toggle('typography')}
        >
          <FontSection />
        </InspectorSection>

        <InspectorSection
          title="Layout"
          icon={<Columns2 className="h-4 w-4" />}
          summary={layoutSummary(meta)}
          open={open === 'layout'}
          onToggle={() => toggle('layout')}
        >
          <ColumnsSection />
        </InspectorSection>

        <InspectorSection
          title="Size and spacing"
          icon={<Ruler className="h-4 w-4" />}
          summary={spacingSummary(meta)}
          open={open === 'spacing'}
          onToggle={() => toggle('spacing')}
        >
          <SpacingControls />
        </InspectorSection>
      </div>
    </div>
  )
}
