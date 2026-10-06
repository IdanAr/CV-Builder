import { describe, it, expect } from 'vitest'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { buildDocx } from '../resume-docx'
import { applyFontScaleToDocx } from '../scale-docx'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const meta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1, sidebarRailWidth: 33, lineSpacing: 1.15, fontScale: 1,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column', columnAssignment: {}, excludedAtsKeywords: [],
}
const data: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer', email: 'jane@test.com' },
  work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01', highlights: ['Did X'] }],
  education: [{ institution: 'MIT', area: 'CS', studyType: 'BSc', endDate: '2016-06' }],
  skills: [{ name: 'TypeScript', keywords: ['React'] }],
}

async function sizes(buf: Uint8Array): Promise<number[]> {
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml')!.async('string')
  return [...xml.matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => Number(m[1]))
}

describe('applyFontScaleToDocx', () => {
  it('returns the input bytes unchanged at scale 1', async () => {
    const raw = await Packer.toBuffer(buildDocx(data, meta))
    const out = await applyFontScaleToDocx(raw, 1)
    expect(Buffer.compare(Buffer.from(raw), out)).toBe(0)
  })

  it('scales every run size in document.xml', async () => {
    const raw = await Packer.toBuffer(buildDocx(data, meta))
    const base = await sizes(raw)
    const out = await applyFontScaleToDocx(raw, 1.05)
    const big = await sizes(out)
    expect(base.length).toBeGreaterThan(5)
    expect(big).toEqual(base.map((n) => Math.max(2, Math.round(n * 1.05))))
  })

  it('keeps the package valid and the text intact', async () => {
    const raw = await Packer.toBuffer(buildDocx(data, meta))
    const out = await applyFontScaleToDocx(raw, 0.95)
    const zip = await JSZip.loadAsync(out)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('Jane Smith')
    expect(xml).toContain('Acme')
    expect(Object.keys(zip.files)).toContain('[Content_Types].xml')
  })

  it('does not touch border sizes', async () => {
    const raw = await Packer.toBuffer(buildDocx(data, meta))
    const grab = async (b: Uint8Array) => (await (await JSZip.loadAsync(b)).file('word/document.xml')!.async('string')).match(/w:sz="\d+"/g)
    expect(await grab(await applyFontScaleToDocx(raw, 1.05))).toEqual(await grab(raw))
  })
})
