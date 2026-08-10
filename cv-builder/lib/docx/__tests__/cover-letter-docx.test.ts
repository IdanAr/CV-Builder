import { describe, it, expect } from 'vitest'
import { Packer } from 'docx'
import JSZip from 'jszip'
import { buildCoverLetterDocx } from '../cover-letter-docx'

describe('buildCoverLetterDocx', () => {
  it('returns a Document that Packer can serialize to buffer', async () => {
    const doc = buildCoverLetterDocx('Dear Hiring Manager, ...')
    const buffer = await Packer.toBuffer(doc)
    expect(buffer.byteLength).toBeGreaterThan(500)
  })

  it('renders a blank-line letter as separate Word paragraphs', async () => {
    const buffer = await Packer.toBuffer(
      buildCoverLetterDocx('ALPHAPARA about the role.\n\nBETAPARA about my background.')
    )
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    const paras = xml.split(/<w:p[ >]/)
    const alphaIdx = paras.findIndex((p) => p.includes('ALPHAPARA'))
    const betaIdx = paras.findIndex((p) => p.includes('BETAPARA'))
    expect(alphaIdx).toBeGreaterThan(-1)
    expect(betaIdx).toBeGreaterThan(-1)
    expect(alphaIdx).not.toBe(betaIdx)
  })

  it('includes the name as a leading paragraph when provided', async () => {
    const buffer = await Packer.toBuffer(buildCoverLetterDocx('Some letter text.', 'Jane Smith'))
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('Jane Smith')
  })

  it('renders bold markers as bold runs in the XML', async () => {
    const buffer = await Packer.toBuffer(buildCoverLetterDocx('This is **bold** text.'))
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toMatch(/<w:b\/>/)
  })
})
