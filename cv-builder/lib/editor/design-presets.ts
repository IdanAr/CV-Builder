/**
 * Named presets over the numeric `meta` fields. A preset is only a labelled
 * value: nothing here is stored, so a value outside every preset (set through
 * an Advanced slider, the API or an old document) is simply "Custom".
 */
export interface Preset {
  id: string
  label: string
  value: number
}

/** `meta.fontScale` (multiplier over each template's own sizes). */
export const TEXT_SIZE_PRESETS: Preset[] = [
  { id: 'smaller', label: 'Smaller', value: 0.95 },
  { id: 'default', label: 'Default', value: 1 },
  { id: 'larger', label: 'Larger', value: 1.05 },
]

/** `meta.lineSpacing`. Normal is the schema default (1.15). */
export const LINE_SPACING_PRESETS: Preset[] = [
  { id: 'compact', label: 'Compact', value: 1.0 },
  { id: 'normal', label: 'Normal', value: 1.15 },
  { id: 'relaxed', label: 'Relaxed', value: 1.3 },
]

/** `meta.pageMargins` in inches. Standard is the schema default (1.0). */
export const MARGIN_PRESETS: Preset[] = [
  { id: 'narrow', label: 'Narrow', value: 0.6 },
  { id: 'standard', label: 'Standard', value: 1.0 },
  { id: 'wide', label: 'Wide', value: 1.3 },
]

const TOLERANCE = 0.001

export function matchPreset(presets: Preset[], value: number | undefined): Preset | undefined {
  if (typeof value !== 'number') return undefined
  return presets.find((p) => Math.abs(p.value - value) < TOLERANCE)
}
