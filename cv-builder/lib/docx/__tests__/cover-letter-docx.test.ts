import { describe, it, expect } from 'vitest'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { buildCoverLetterDocx } from '../cover-letter-docx'
import type { CoverLetterRenderInput } from '@/lib/coverletter/render-input'

const BASE: CoverLetterRenderInput = {
  content: 'Dear Ms Rivera,\n\nI would like to apply for the role.\n\nBest regards,\nJordan Example',
  design: 'classic',
  language: 'en',
  name: 'Jordan Example',
  contact: 'jordan@example.com · 050-0000000 · Haifa',
  date: '21 October 2026',
  recipient: ['Ms Rivera', 'Acme Widgets'],
  subject: 'Re: Widget Engineer, Acme Widgets',
  title: 'Cover Letter - Widget Engineer - Acme Widgets',
  accentColor: '#1a7f4b',
}

async function parts(input: Partial<CoverLetterRenderInput> = {}) {
  const buffer = await Packer.toBuffer(buildCoverLetterDocx({ ...BASE, ...input }))
  const zip = await JSZip.loadAsync(buffer)
  const read = async (path: string) => (zip.file(path) ? zip.file(path)!.async('string') : '')
  return {
    xml: await read('word/document.xml'),
    numbering: await read('word/numbering.xml'),
    styles: await read('word/styles.xml'),
    core: await read('docProps/core.xml'),
  }
}

const paragraphs = (xml: string): string[] => xml.match(/<w:p>[\s\S]*?<\/w:p>|<w:p [\s\S]*?<\/w:p>/g) ?? []

describe('buildCoverLetterDocx', () => {
  it('serializes to a buffer Packer can write', async () => {
    const buffer = await Packer.toBuffer(buildCoverLetterDocx({ ...BASE, name: undefined, contact: undefined, date: undefined, recipient: [], subject: null }))
    expect(buffer.byteLength).toBeGreaterThan(500)
  })

  it.each(['classic', 'accent-edge'] as const)('%s: uses no tables, text boxes, floating shapes or columns', async (design) => {
    const { xml } = await parts({ design })
    expect(xml).not.toMatch(/<w:tbl[ >]|<w:txbxContent|<wp:anchor|<w:drawing|<w:pict|<w:cols w:num="[2-9]"/)
  })

  it('renders blank-line separated text as separate Word paragraphs', async () => {
    const { xml } = await parts({ content: 'ALPHAPARA about the role.\n\nBETAPARA about my background.' })
    const ps = paragraphs(xml)
    const a = ps.findIndex((p) => p.includes('ALPHAPARA'))
    const b = ps.findIndex((p) => p.includes('BETAPARA'))
    expect(a).toBeGreaterThan(-1)
    expect(b).toBeGreaterThan(-1)
    expect(a).not.toBe(b)
  })

  it('renders bold markers as bold runs', async () => {
    const { xml } = await parts({ content: 'This is **bold** text.' })
    expect(xml).toMatch(/<w:b\/>/)
  })

  it('classic: centres the name and contact, with an accent bottom border on the contact paragraph', async () => {
    const { xml } = await parts({ design: 'classic' })
    const ps = paragraphs(xml)
    const nameP = ps.find((p) => p.includes('Jordan Example') && !p.includes('Best regards'))!
    const contactP = ps.find((p) => p.includes('jordan@example.com'))!
    expect(nameP).toContain('<w:jc w:val="center"/>')
    expect(contactP).toContain('<w:jc w:val="center"/>')
    expect(contactP).toMatch(/<w:pBdr>[\s\S]*<w:bottom [^>]*w:color="1a7f4b"/)
    expect(contactP).toMatch(/<w:bottom [^>]*w:sz="8"/)
    expect(contactP).not.toContain('<w:left ')
    expect(nameP).not.toContain('<w:pBdr>')
    expect(xml.match(/<w:pBdr>/g)).toHaveLength(1)
  })

  it('classic: puts the rule on the name paragraph when there is no contact line', async () => {
    const { xml } = await parts({ design: 'classic', contact: undefined })
    const nameP = paragraphs(xml).find((p) => p.includes('Jordan Example') && !p.includes('Best regards'))!
    expect(nameP).toMatch(/<w:bottom [^>]*w:color="1a7f4b"/)
  })

  it('accent edge: one left-aligned header paragraph holds name, a line break and contact, with one left border', async () => {
    const { xml } = await parts({ design: 'accent-edge' })
    const bordered = paragraphs(xml).filter((p) => p.includes('<w:left '))
    expect(bordered).toHaveLength(1)
    const p = bordered[0]
    expect(p).toMatch(/<w:pBdr>[\s\S]*<w:left [^>]*w:color="1a7f4b"[^>]*>/)
    expect(p).toMatch(/<w:left [^>]*w:sz="32"/)
    expect(p).not.toContain('<w:bottom')
    expect(p).toContain('<w:ind ')
    expect(p).not.toContain('<w:jc w:val="center"/>')
    expect(p).toContain('Jordan Example')
    expect(p).toContain('jordan@example.com')
    expect(p).toContain('<w:br/>')
    expect(p.indexOf('Jordan Example')).toBeLessThan(p.indexOf('<w:br/>'))
    expect(p.indexOf('<w:br/>')).toBeLessThan(p.indexOf('jordan@example.com'))
    expect(xml.match(/<w:pBdr>/g)).toHaveLength(1)
  })

  it('accent edge: colours the name with the accent', async () => {
    const { xml } = await parts({ design: 'accent-edge' })
    const p = paragraphs(xml).find((q) => q.includes('<w:left '))!
    const nameRun = p.match(/<w:r>(?:(?!<\/w:r>)[\s\S])*Jordan Example[\s\S]*?<\/w:r>/)![0]
    expect(nameRun).toContain('w:val="1a7f4b"')
  })

  it('falls back to the default accent for an invalid colour and expands 3-digit hex', async () => {
    const bad = await parts({ accentColor: 'red; drop' })
    expect(bad.xml).toMatch(/w:color="0066cc"/i)
    const short = await parts({ accentColor: '#0af' })
    expect(short.xml).toMatch(/w:color="00aaff"/i)
    // The PDF needs the "#" too, so a bare hex falls back in both formats.
    const bare = await parts({ accentColor: '1a7f4b' })
    expect(bare.xml).toMatch(/w:color="0066cc"/i)
    const none = await parts({ accentColor: undefined })
    expect(none.xml).toMatch(/w:color="0066cc"/i)
  })

  it('renders a 3-item list as three numbered paragraphs, with a bullet level and no typed markers', async () => {
    const { xml, numbering } = await parts({
      content: 'Dear Ms Rivera,\n\n- First **point**\n- Second point\n- Third point\n\nBest regards',
    })
    const items = paragraphs(xml).filter((p) => p.includes('<w:numPr>'))
    expect(items).toHaveLength(3)
    expect(items[0]).toContain('First')
    expect(items[0]).toMatch(/<w:b\/>/)
    expect(items[1]).toContain('Second point')
    expect(items[2]).toContain('Third point')
    expect(xml).not.toMatch(/>[•\-] /)
    expect(numbering).toMatch(/<w:numFmt w:val="bullet"\/>/)
  })

  it('keeps the reading order: name, contact, date, recipient, subject, greeting, body', async () => {
    const { xml } = await parts()
    const order = ['Jordan Example', 'jordan@example.com', '21 October 2026', 'Ms Rivera', 'Acme Widgets', 'Re: Widget Engineer', 'Dear Ms Rivera', 'apply for the role', 'Best regards']
    const at = order.map((s) => xml.indexOf(s))
    at.forEach((n) => expect(n).toBeGreaterThan(-1))
    // 'Ms Rivera' first appears in the recipient block, ahead of the greeting
    expect(at).toEqual([...at].sort((a, b) => a - b))
  })

  it('leaves out "Re:" when there is no subject', async () => {
    const { xml } = await parts({ subject: null })
    expect(xml).not.toContain('Re:')
  })

  it('renders the subject in bold', async () => {
    const { xml } = await parts()
    const p = paragraphs(xml).find((q) => q.includes('Re: Widget Engineer'))!
    expect(p).toMatch(/<w:b\/>/)
  })

  it('omits the header when there is no name or contact', async () => {
    const { xml } = await parts({ name: undefined, contact: undefined })
    expect(xml).not.toContain('<w:pBdr>')
    expect(xml).toContain('21 October 2026')
  })

  it('maps web fonts to ATS-safe ones for the body and the name', async () => {
    const { xml } = await parts({ font: 'Lato', headerFont: 'IBM Plex Sans' })
    expect(xml).toContain('w:ascii="Arial"')
    expect(xml).toContain('w:ascii="Calibri"')
    expect(xml).not.toContain('Lato')
    expect(xml).not.toContain('IBM Plex')
  })

  it('writes the title to the document properties', async () => {
    const { core } = await parts()
    expect(core).toContain('Cover Letter - Widget Engineer - Acme Widgets')
  })

  it('keeps the bidirectional language only for a he letter', async () => {
    const he = await parts({ language: 'he' })
    expect(he.styles).toMatch(/<w:lang [^>]*w:bidi="he-IL"/)
    const en = await parts({ language: 'en' })
    expect(en.styles).toContain('en-GB')
    expect(en.styles).not.toMatch(/w:bidi=/)
  })
})
