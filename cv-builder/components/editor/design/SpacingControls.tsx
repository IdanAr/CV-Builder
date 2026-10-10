'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import {
  LINE_SPACING_PRESETS,
  MARGIN_PRESETS,
  TEXT_SIZE_PRESETS,
  matchPreset,
  type Preset,
} from '@/lib/editor/design-presets'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'
import { SegmentedControl } from './SegmentedControl'

interface GroupConfig {
  title: string
  groupLabel: string
  presets: Preset[]
  value: number
  format: (v: number) => string
  onSet: (v: number) => void
  slider: { label: string; min: number; max: number; step: number }
}

function readout({ presets, value, format }: GroupConfig): string {
  const matched = matchPreset(presets, value)
  return matched ? matched.label : `Custom (${format(value)})`
}

/** Short summary for the collapsed Design section, e.g. "Default · Normal · Standard". */
export function spacingSummary(meta: Pick<ResumeMeta, 'fontScale' | 'lineSpacing' | 'pageMargins'>): string {
  return [
    matchPreset(TEXT_SIZE_PRESETS, meta.fontScale ?? 1)?.label ?? 'Custom',
    matchPreset(LINE_SPACING_PRESETS, meta.lineSpacing)?.label ?? 'Custom',
    matchPreset(MARGIN_PRESETS, meta.pageMargins)?.label ?? 'Custom',
  ].join(' · ')
}

export function SpacingControls() {
  const meta = useResumeEditorStore((s) => s.meta)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const set = (patch: Partial<ResumeMeta>) => setMeta(patch)

  const groups: GroupConfig[] = [
    {
      title: 'Text size',
      groupLabel: 'Text size presets',
      presets: TEXT_SIZE_PRESETS,
      value: meta.fontScale ?? 1,
      format: (v) => v.toFixed(2),
      onSet: (v) => set({ fontScale: v }),
      slider: { label: 'Text size scale', min: 0.9, max: 1.1, step: 0.01 },
    },
    {
      title: 'Line spacing',
      groupLabel: 'Line spacing presets',
      presets: LINE_SPACING_PRESETS,
      value: meta.lineSpacing,
      format: (v) => v.toFixed(2),
      onSet: (v) => set({ lineSpacing: v }),
      slider: { label: 'Line spacing', min: 1.0, max: 1.3, step: 0.05 },
    },
    {
      title: 'Margins',
      groupLabel: 'Margin presets',
      presets: MARGIN_PRESETS,
      value: meta.pageMargins,
      format: (v) => `${v.toFixed(1)}"`,
      onSet: (v) => set({ pageMargins: v }),
      slider: { label: 'Page margins', min: 0.5, max: 1.5, step: 0.1 },
    },
  ]

  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="mb-1 flex items-baseline justify-between text-xs font-medium text-fg-muted">
            {g.title} <span className="font-mono font-normal text-fg-subtle">{readout(g)}</span>
          </p>
          <SegmentedControl
            label={g.groupLabel}
            options={g.presets.map((p) => ({ id: p.id, label: p.label }))}
            value={matchPreset(g.presets, g.value)?.id}
            onChange={(id) => g.onSet(g.presets.find((p) => p.id === id)!.value)}
          />
        </div>
      ))}
      {/* One disclosure for all three sliders, instead of one per row. */}
      <details className="group pt-1">
        <summary className="cursor-pointer list-none text-xs font-medium text-fg-body hover:text-fg-heading">
          <span className="inline-block transition-transform group-open:rotate-90">›</span> Fine-tune with sliders
        </summary>
        <div className="mt-2 space-y-3">
          {groups.map((g) => (
            <label key={g.title} className="block">
              <span className="flex justify-between text-xs text-fg-muted">
                {g.title}
                <span className="font-mono text-fg-subtle">{g.format(g.value)}</span>
              </span>
              <input
                type="range"
                aria-label={g.slider.label}
                min={g.slider.min}
                max={g.slider.max}
                step={g.slider.step}
                value={g.value}
                onChange={(e) => g.onSet(parseFloat(e.target.value))}
                className="mt-1 w-full accent-primary"
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  )
}
