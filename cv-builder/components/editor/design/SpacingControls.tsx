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

interface GroupProps {
  title: string
  groupLabel: string
  presets: Preset[]
  value: number
  format: (v: number) => string
  onSet: (v: number) => void
  slider: { label: string; min: number; max: number; step: number }
}

function Group({ title, groupLabel, presets, value, format, onSet, slider }: GroupProps) {
  const matched = matchPreset(presets, value)
  const readout = matched ? matched.label : `Custom (${format(value)})`
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-fg-muted">
        {title} <span className="font-mono text-fg-subtle">{readout}</span>
      </p>
      <SegmentedControl
        label={groupLabel}
        options={presets.map((p) => ({ id: p.id, label: p.label }))}
        value={matched?.id}
        onChange={(id) => onSet(presets.find((p) => p.id === id)!.value)}
      />
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-fg-subtle">Advanced</summary>
        <input
          type="range"
          aria-label={slider.label}
          min={slider.min}
          max={slider.max}
          step={slider.step}
          value={value}
          onChange={(e) => onSet(parseFloat(e.target.value))}
          className="mt-1 w-full accent-accent-600"
        />
      </details>
    </div>
  )
}

export function SpacingControls() {
  const meta = useResumeEditorStore((s) => s.meta)
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  const set = (patch: Partial<ResumeMeta>) => setMeta(patch)

  return (
    <div className="space-y-3">
      <Group
        title="Text size"
        groupLabel="Text size presets"
        presets={TEXT_SIZE_PRESETS}
        value={meta.fontScale ?? 1}
        format={(v) => v.toFixed(2)}
        onSet={(v) => set({ fontScale: v })}
        slider={{ label: 'Text size scale', min: 0.9, max: 1.1, step: 0.01 }}
      />
      <Group
        title="Line spacing"
        groupLabel="Line spacing presets"
        presets={LINE_SPACING_PRESETS}
        value={meta.lineSpacing}
        format={(v) => v.toFixed(2)}
        onSet={(v) => set({ lineSpacing: v })}
        slider={{ label: 'Line spacing', min: 1.0, max: 1.3, step: 0.05 }}
      />
      <Group
        title="Margins"
        groupLabel="Margin presets"
        presets={MARGIN_PRESETS}
        value={meta.pageMargins}
        format={(v) => `${v.toFixed(1)}"`}
        onSet={(v) => set({ pageMargins: v })}
        slider={{ label: 'Page margins', min: 0.5, max: 1.5, step: 0.1 }}
      />
    </div>
  )
}
