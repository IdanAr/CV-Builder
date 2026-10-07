'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { TemplateGrid } from './design/TemplateGrid'
import { ColumnsSection } from './design/ColumnsSection'
import { FontSection } from './design/FontSection'
import { ColorField } from './design/ColorField'
import { SpacingControls } from './design/SpacingControls'

const sectionTitle = 'mb-3 text-xs font-semibold uppercase tracking-wide text-fg-subtle'

export function DesignPanel() {
  const primaryColor = useResumeEditorStore((s) => s.meta.primaryColor)
  const accentColor = useResumeEditorStore((s) => s.meta.accentColor)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  return (
    <div className="mx-auto max-w-sm space-y-7 px-4 py-6">
      <section aria-labelledby="design-template">
        <h3 id="design-template" className={sectionTitle}>Template</h3>
        <TemplateGrid />
      </section>
      <ColumnsSection />
      <section aria-labelledby="design-fonts">
        <h3 id="design-fonts" className={sectionTitle}>Fonts</h3>
        <FontSection />
      </section>
      <section aria-labelledby="design-colors">
        <h3 id="design-colors" className={sectionTitle}>Colors</h3>
        {/* Stacked vertically so each picker's swatch row and preset palette
            get the panel's full width. */}
        <div className="space-y-5">
          <ColorField
            label="Primary color"
            value={primaryColor}
            onCommit={(hex) => setMeta({ primaryColor: hex })}
            swatchLabel="Custom primary color"
            presetsLabel="Primary color presets"
            placeholder="#000000"
          />
          <ColorField
            label="Accent color"
            value={accentColor}
            onCommit={(hex) => setMeta({ accentColor: hex })}
            swatchLabel="Custom accent color"
            presetsLabel="Accent color presets"
            placeholder="#0066cc"
          />
        </div>
      </section>
      <section aria-labelledby="design-spacing">
        <h3 id="design-spacing" className={sectionTitle}>Size and spacing</h3>
        <SpacingControls />
      </section>
    </div>
  )
}
