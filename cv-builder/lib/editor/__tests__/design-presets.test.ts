import { describe, it, expect } from 'vitest'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import {
  TEXT_SIZE_PRESETS, LINE_SPACING_PRESETS, MARGIN_PRESETS, matchPreset,
} from '../design-presets'

describe('design presets', () => {
  it('every preset value is valid for the schema field it controls', () => {
    for (const p of TEXT_SIZE_PRESETS) expect(ResumeMetaSchema.safeParse({ fontScale: p.value }).success).toBe(true)
    for (const p of LINE_SPACING_PRESETS) expect(ResumeMetaSchema.safeParse({ lineSpacing: p.value }).success).toBe(true)
    for (const p of MARGIN_PRESETS) expect(ResumeMetaSchema.safeParse({ pageMargins: p.value }).success).toBe(true)
  })

  it('the schema defaults land on a preset (a new CV never shows "Custom")', () => {
    const d = ResumeMetaSchema.parse({})
    expect(matchPreset(TEXT_SIZE_PRESETS, d.fontScale)?.id).toBe('default')
    expect(matchPreset(LINE_SPACING_PRESETS, d.lineSpacing)?.id).toBe('normal')
    expect(matchPreset(MARGIN_PRESETS, d.pageMargins)?.id).toBe('standard')
  })

  it('matchPreset is tolerant of float noise and returns undefined for custom values', () => {
    expect(matchPreset(LINE_SPACING_PRESETS, 1.1500000001)?.id).toBe('normal')
    expect(matchPreset(LINE_SPACING_PRESETS, 1.2)).toBeUndefined()
    expect(matchPreset(LINE_SPACING_PRESETS, undefined)).toBeUndefined()
  })
})
