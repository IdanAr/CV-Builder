import { describe, it, expect } from 'vitest'
import { buildDocx } from '../resume-docx'
import { Packer } from 'docx'
import JSZip from 'jszip'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [],
}

const sampleData: ResumeData = {
  basics: { name: 'Jane Smith', label: 'Engineer', email: 'jane@test.com' },
  work: [{ name: 'Acme', position: 'Dev', startDate: '2020-01', highlights: ['Did X'] }],
  education: [{ institution: 'MIT', area: 'CS', studyType: 'BSc', startDate: '2016-09', endDate: '2020-06' }],
  skills: [{ name: 'TypeScript', level: 'Expert', keywords: ['React', 'Node.js'] }],
}

describe('buildDocx', () => {
  it('returns a Document that Packer can serialize to buffer', async () => {
    const doc = buildDocx(sampleData, defaultMeta)
    const buffer = await Packer.toBuffer(doc)
    expect(buffer.byteLength).toBeGreaterThan(1000)
  })

  it('renders a blank-line summary as separate Word paragraphs', async () => {
    const data: ResumeData = {
      basics: { name: 'X', summary: 'ALPHAPARA about pipelines.\n\nBETAPARA about platforms.' },
    }
    const buffer = await Packer.toBuffer(buildDocx(data, defaultMeta))
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    const paras = xml.split(/<w:p[ >]/)
    const alphaIdx = paras.findIndex(p => p.includes('ALPHAPARA'))
    const betaIdx = paras.findIndex(p => p.includes('BETAPARA'))
    expect(alphaIdx).toBeGreaterThan(-1)
    expect(betaIdx).toBeGreaterThan(-1)
    // Both sentinels must live in different <w:p> blocks — i.e. real paragraphs.
    expect(alphaIdx).not.toBe(betaIdx)
  })

  it('serializes without error when data is empty', async () => {
    const doc = buildDocx({}, defaultMeta)
    const buffer = await Packer.toBuffer(doc)
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it('maps Lato to Arial', () => {
    const doc = buildDocx(sampleData, { ...defaultMeta, fontFamily: 'Lato' })
    expect(doc).toBeTruthy()
  })

  it('two-column layout produces a table in the DOCX XML', async () => {
    const doc = buildDocx(sampleData, { ...defaultMeta, layout: 'two-column' })
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:tbl')
    // Both columns should have invisible borders
    expect(xml).toContain('w:val="none"')
  })

  it('sidebar template renders a shaded rail table with the name inside it', async () => {
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'sidebar', primaryColor: '#1e3a5f' }
    const doc = buildDocx({ ...sampleData, languages: [{ language: 'English', fluency: 'Native' }] }, meta)
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    // The rail is a table cell shaded with the primary color
    expect(xml).toContain('<w:tbl')
    expect(xml.toLowerCase()).toContain('1e3a5f')
    // Name and rail sections live inside the table (rail cell), before the main column
    const tblIdx = xml.indexOf('<w:tbl')
    expect(xml.indexOf('Jane Smith')).toBeGreaterThan(tblIdx)
    const skillsIdx = xml.indexOf('SKILLS')
    const workIdx = xml.indexOf('WORK EXPERIENCE')
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeGreaterThan(-1)
    // Rail (skills/languages) is the left cell, so it precedes the main column content
    expect(skillsIdx).toBeLessThan(workIdx)
  })

  it('two-column layout puts work in left cell and skills in right cell', async () => {
    const doc = buildDocx(sampleData, { ...defaultMeta, layout: 'two-column' })
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    const workIdx = xml.indexOf('Work Experience')
    const skillsIdx = xml.indexOf('Skills')
    // Work must appear before Skills in document order (left cell before right cell)
    expect(workIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeLessThan(skillsIdx)
  })

  it('sidebar columnAssignment moves skills to main column and work to rail', async () => {
    const meta: ResumeMeta = {
      ...defaultMeta,
      templateId: 'sidebar',
      primaryColor: '#1e3a5f',
      columnAssignment: { skills: 'right', work: 'left' },
      sectionOrder: ['work', 'skills'],
    }
    const doc = buildDocx(sampleData, meta)
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('<w:tbl')
    // With work overridden to left and skills to right:
    // work heading should appear before skills heading in XML (left cell before right cell)
    const workIdx = xml.indexOf('WORK EXPERIENCE')
    const skillsIdx = xml.indexOf('SKILLS')
    expect(workIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeLessThan(skillsIdx)
  })

  it('sidebar default columnAssignment still puts skills in rail (left) and work in main (right)', async () => {
    const meta: ResumeMeta = {
      ...defaultMeta,
      templateId: 'sidebar',
      primaryColor: '#1e3a5f',
      columnAssignment: {},
      sectionOrder: ['work', 'skills'],
    }
    const doc = buildDocx(sampleData, meta)
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    const xml = await zip.file('word/document.xml')!.async('string')
    // Default: skills → left (rail), work → right (main)
    // skills heading appears before work heading in XML
    const skillsIdx = xml.indexOf('SKILLS')
    const workIdx = xml.indexOf('WORK EXPERIENCE')
    expect(skillsIdx).toBeGreaterThan(-1)
    expect(workIdx).toBeGreaterThan(-1)
    expect(skillsIdx).toBeLessThan(workIdx)
  })
})

describe('buildDocx ATS typography bands (Sidebar rail + Executive name)', () => {
  async function docXml(doc: ReturnType<typeof buildDocx>): Promise<string> {
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    return zip.file('word/document.xml')!.async('string')
  }

  it('sidebar rail section headings render at 12pt (w:sz 24, half-points)', async () => {
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'sidebar', primaryColor: '#1e3a5f' }
    const xml = await docXml(buildDocx({ ...sampleData, languages: [{ language: 'English', fluency: 'Native' }] }, meta))
    // The rail heading run for "SKILLS" must carry sz=24 (12pt), not the old sz=20 (10pt)
    const skillsHeadingRunMatch = xml.match(/<w:r>(?:(?!<w:r>)[\s\S])*?SKILLS(?:(?!<w:r>)[\s\S])*?<\/w:r>/)
    expect(skillsHeadingRunMatch).not.toBeNull()
    expect(skillsHeadingRunMatch![0]).toContain('w:sz w:val="24"')
    expect(skillsHeadingRunMatch![0]).not.toContain('w:sz w:val="20"')
  })

  it('sidebar rail body/contact text renders at 10pt (w:sz 20, half-points), never below', async () => {
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'sidebar', primaryColor: '#1e3a5f' }
    const xml = await docXml(buildDocx({ ...sampleData, languages: [{ language: 'English', fluency: 'Native' }] }, meta))
    // Rail contact text (email) must not use the old 9pt (sz=18) size
    const emailRunMatch = xml.match(/<w:r>(?:(?!<w:r>)[\s\S])*?jane@test\.com(?:(?!<w:r>)[\s\S])*?<\/w:r>/)
    expect(emailRunMatch).not.toBeNull()
    expect(emailRunMatch![0]).not.toContain('w:sz w:val="18"')
    expect(emailRunMatch![0]).toContain('w:sz w:val="20"')
    // Rail body text (skills keywords, which sit in the rail by default) must not
    // use the old 9.5pt (sz=19) size
    const keywordsRunMatch = xml.match(/<w:r>(?:(?!<w:r>)[\s\S])*?Node\.js(?:(?!<w:r>)[\s\S])*?<\/w:r>/)
    expect(keywordsRunMatch).not.toBeNull()
    expect(keywordsRunMatch![0]).not.toContain('w:sz w:val="19"')
    expect(keywordsRunMatch![0]).toContain('w:sz w:val="20"')
  })

  it('executive name renders at 22pt (w:sz 44, half-points), not the old 26pt', async () => {
    // The name paragraph now carries the size via the Title style (Task 9)
    // rather than an inline <w:sz> on the run, so the regression this test
    // guards against is checked in word/styles.xml instead of document.xml.
    const meta: ResumeMeta = { ...defaultMeta, templateId: 'executive' }
    const buffer = await Packer.toBuffer(buildDocx(sampleData, meta))
    const zip = await JSZip.loadAsync(buffer)
    const stylesXml = await zip.file('word/styles.xml')!.async('string')
    const titleStyleMatch = stylesXml.match(/<w:style w:type="paragraph" w:styleId="Title">[\s\S]*?<\/w:style>/)
    expect(titleStyleMatch).not.toBeNull()
    expect(titleStyleMatch![0]).toContain('w:sz w:val="44"')
    expect(titleStyleMatch![0]).not.toContain('w:sz w:val="52"')
  })
})

describe('buildDocx ats mode', () => {
  async function docXml(doc: ReturnType<typeof buildDocx>): Promise<string> {
    const buffer = await Packer.toBuffer(doc)
    const zip = await JSZip.loadAsync(buffer)
    return zip.file('word/document.xml')!.async('string')
  }

  const fullData = {
    ...sampleData,
    languages: [{ language: 'English', fluency: 'Native' }],
  }

  it('sidebar template has no tables in ats mode', async () => {
    const meta = { ...defaultMeta, templateId: 'sidebar', sectionOrder: ['work', 'education', 'skills', 'languages'] }
    const xml = await docXml(buildDocx(fullData, meta, 'ats'))
    expect(xml).not.toContain('<w:tbl')
    // Rail content folds back inline, in sectionOrder order
    const order = ['Jane Smith', 'WORK EXPERIENCE', 'Acme', 'EDUCATION', 'MIT', 'SKILLS', 'TypeScript', 'LANGUAGES', 'English']
    let last = -1
    for (const part of order) {
      const idx = xml.indexOf(part)
      expect(idx, `"${part}" missing or out of order`).toBeGreaterThan(last)
      last = idx
    }
  })

  it('two-column layout has no tables in ats mode', async () => {
    const xml = await docXml(buildDocx(fullData, { ...defaultMeta, layout: 'two-column' }, 'ats'))
    expect(xml).not.toContain('<w:tbl')
  })

  it('ats mode has no shading anywhere (no filled header, no rail)', async () => {
    const meta = { ...defaultMeta, templateId: 'modern', primaryColor: '#1e3a5f' }
    const xml = await docXml(buildDocx(fullData, meta, 'ats'))
    expect(xml).not.toContain('<w:shd')
  })

  it('defaults to designed mode (sidebar still renders its rail table)', async () => {
    const meta = { ...defaultMeta, templateId: 'sidebar' }
    const xml = await docXml(buildDocx(fullData, meta))
    expect(xml).toContain('<w:tbl')
  })

  it('ats mode keeps the Summary heading regardless of stored layout', async () => {
    const withSummary = {
      ...fullData,
      basics: { ...fullData.basics, summary: 'Seasoned platform engineer.' },
    }
    const xml = await docXml(buildDocx(withSummary, { ...defaultMeta, layout: 'two-column' }, 'ats'))
    const headingIdx = xml.indexOf('SUMMARY')
    const textIdx = xml.indexOf('Seasoned platform engineer.')
    expect(headingIdx).toBeGreaterThan(-1)
    expect(textIdx).toBeGreaterThan(headingIdx)
  })
})

async function documentXml(doc: ReturnType<typeof buildDocx>): Promise<string> {
  const buffer = await Packer.toBuffer(doc)
  const zip = await JSZip.loadAsync(buffer)
  return zip.file('word/document.xml')!.async('string')
}

describe('docx semantic structure', () => {
  it('applies Heading1 to section headings instead of inline sizing', async () => {
    const xml = await documentXml(buildDocx(sampleData, defaultMeta, 'designed'))
    expect(xml).toContain('w:pStyle w:val="Heading1"')
  })

  it('applies Title to the candidate name', async () => {
    const xml = await documentXml(buildDocx(sampleData, defaultMeta, 'designed'))
    expect(xml).toContain('w:pStyle w:val="Title"')
  })

  it('keeps headings with the content that follows', async () => {
    const xml = await documentXml(buildDocx(sampleData, defaultMeta, 'designed'))
    expect(xml).toContain('<w:keepNext')
    // keepNext alone is satisfied by sectionHeading; keepLines is what stops a
    // position or summary paragraph splitting mid-entry, and deleting both
    // source lines previously left the suite green.
    expect(xml).toContain('<w:keepLines')
  })

  it('does not let the Heading2 style bold the entry-head date range', async () => {
    // ECMA-376 §17.7.2: an absent <w:b> on a run means *inherit*, not *off*.
    // A bold Heading2 style therefore reaches the date run, which sets no bold
    // of its own — bolding work/volunteer dates while the identically-shaped
    // dates on education, awards and publications stayed regular.
    const { stylesXml } = await docxParts(buildDocx(sampleData, defaultMeta, 'designed'))
    const heading2 = stylesXml.match(/<w:style [^>]*w:styleId="Heading2"[\s\S]*?<\/w:style>/)
    expect(heading2, 'Heading2 style not found').not.toBeNull()
    expect(heading2![0]).not.toContain('<w:b/>')
  })

  it('stays free of tables, text boxes and drawings in single-column mode', async () => {
    const xml = await documentXml(
      buildDocx(sampleData, { ...defaultMeta, layout: 'single-column' }, 'ats')
    )
    expect(xml).not.toContain('<w:tbl>')
    expect(xml).not.toContain('txbxContent')
    expect(xml).not.toContain('<w:drawing>')
  })
})

// Structural replacement for "open the file in Word and check the navigation
// pane" (not available in this environment). Word's outline/navigation pane
// and an ATS parser both key off the same two facts, so both are asserted
// against the real packed .docx XML:
//   1. word/styles.xml defines styleId="Heading1"/"Title" using Word's
//      built-in style *names* (not just ids) -- the name is what makes Word's
//      built-in "Quick Styles"/outline machinery treat the style as a real
//      heading rather than an arbitrarily-named custom style.
//   2. word/document.xml references those styles via <w:pStyle>, and the
//      heading run no longer carries the inline <w:sz> that used to be the
//      only signal of "this is a heading".
async function docxParts(doc: ReturnType<typeof buildDocx>): Promise<{ documentXml: string; stylesXml: string }> {
  const buffer = await Packer.toBuffer(doc)
  const zip = await JSZip.loadAsync(buffer)
  const [documentXml, stylesXml] = await Promise.all([
    zip.file('word/document.xml')!.async('string'),
    zip.file('word/styles.xml')!.async('string'),
  ])
  return { documentXml, stylesXml }
}

describe('soft line breaks', () => {
  it('renders a single newline within a highlight as a line break, not a space', async () => {
    const data: ResumeData = {
      work: [{ name: 'Acme', position: 'Engineer', highlights: ['Line one\nLine two'] }],
    }
    const xml = await documentXml(buildDocx(data, defaultMeta))
    expect(xml).toContain('<w:br')
    expect(xml).not.toMatch(/Line one\s+Line two/) // not collapsed to a space by any earlier step
  })

  it('renders a blank line as a separate Paragraph, not a Break', async () => {
    const data: ResumeData = {
      basics: { name: 'X', summary: 'Para one\n\nPara two' },
    }
    const xml = await documentXml(buildDocx(data, defaultMeta))
    expect(xml).toContain('Para one')
    expect(xml).toContain('Para two')
  })
})

describe('docx outline verification (Word nav pane / ATS outline, structural replacement for opening in Word)', () => {
  it('styles.xml defines Heading1 and Title exactly once each, under their real built-in Word names', async () => {
    const { stylesXml } = await docxParts(buildDocx(sampleData, defaultMeta, 'designed'))

    // docx's own DefaultStylesFactory always emits a Title/Heading1/Heading2
    // style; buildDocxStyles (lib/docx/styles.ts) customizes those built-ins
    // in place via `styles.default.title`/`.heading1`/`.heading2` rather than
    // declaring new `paragraphStyles` with colliding ids -- so each id must
    // appear exactly once in the packed XML, not twice.
    expect(stylesXml.match(/w:styleId="Heading1"/g)).toHaveLength(1)
    expect(stylesXml.match(/w:styleId="Title"/g)).toHaveLength(1)

    const heading1Style = stylesXml.match(/<w:style w:type="paragraph" w:styleId="Heading1">[\s\S]*?<\/w:style>/)
    expect(heading1Style).not.toBeNull()
    expect(heading1Style![0]).toContain('<w:name w:val="Heading 1"/>')

    const titleStyle = stylesXml.match(/<w:style w:type="paragraph" w:styleId="Title">[\s\S]*?<\/w:style>/)
    expect(titleStyle).not.toBeNull()
    expect(titleStyle![0]).toContain('<w:name w:val="Title"/>')
  })

  it('document.xml references Heading1 via w:pStyle on section headings, with no inline w:sz duplicating it', async () => {
    const { documentXml } = await docxParts(buildDocx(sampleData, defaultMeta, 'designed'))

    const headingParagraph = documentXml.match(/<w:p><w:pPr><w:pStyle w:val="Heading1"\/>[\s\S]*?<\/w:p>/)
    expect(headingParagraph).not.toBeNull()
    // "Work Experience" is the FIRST Heading1 only because `sampleData` has no
    // basics.summary — a summary would emit its own section heading ahead of
    // it. If a future fixture change adds one, this fails loudly rather than
    // silently, but the coupling is deliberate: matching the first Heading1
    // keeps the regex simple.
    expect(headingParagraph![0]).toContain('Work Experience')
    // The style now owns sizing -- no inline <w:sz> left on the run
    expect(headingParagraph![0]).not.toContain('<w:sz')
  })
})

describe('multiple labeled URLs', () => {
  const dataWithProfiles: ResumeData = {
    basics: {
      name: 'Jane Smith',
      profiles: [
        { id: 'p1', label: 'Portfolio', url: 'https://janesmith.dev' },
        { id: 'p2', url: 'https://github.com/janesmith' },
      ],
    },
  }

  it('renders each profile as a hyperlink in the main header contact row', async () => {
    const xml = await documentXml(buildDocx(dataWithProfiles, defaultMeta))
    expect(xml).toContain('Portfolio')
    expect(xml).toContain('github.com/janesmith')
    expect(xml).toContain('hyperlink') // ExternalHyperlink relationship marker, per existing XML-inspection convention
  })

  it('renders each profile in the Sidebar rail contact block', async () => {
    const xml = await documentXml(buildDocx(dataWithProfiles, { ...defaultMeta, templateId: 'sidebar' }))
    expect(xml).toContain('Portfolio')
    expect(xml).toContain('github.com/janesmith')
  })
})

describe('nested roles', () => {
  const dataWithWorkRoles: ResumeData = {
    work: [{
      name: 'Meta', position: 'Data Analyst', startDate: '2019-01', endDate: '2021-01', highlights: [],
      roles: [{ id: 'r1', position: 'Data Team Lead', startDate: '2021-01', endDate: undefined, summary: 'Led the team.', highlights: ['Grew headcount 3x'] }],
    }],
  }

  it('renders the aggregate range in the work entry heading and both roles beneath it', async () => {
    const xml = await documentXml(buildDocx(dataWithWorkRoles, defaultMeta))
    expect(xml).toContain('Meta')
    expect(xml).toContain('Data Analyst')
    expect(xml).toContain('Data Team Lead')
    expect(xml).toContain('Grew headcount 3x')
  })

  it('renders nested education roles', async () => {
    const xml = await documentXml(buildDocx({
      education: [{
        institution: 'MIT', studyType: 'BSc', area: 'CS', startDate: '2015-09', endDate: '2019-06',
        roles: [{ id: 'r1', studyType: 'MSc', area: 'CS', startDate: '2020-09', endDate: '2022-06' }],
      }],
    }, defaultMeta))
    expect(xml).toContain('BSc')
    expect(xml).toContain('MSc')
  })

  it('renders nested custom-section roles (Military Service)', async () => {
    const xml = await documentXml(buildDocx({
      customSections: [{
        id: 'cs1', name: 'Military Service', enabledFields: ['dateRange', 'roles'],
        items: [{ id: 'i1', title: 'IDF', roles: [{ id: 'r1', title: 'Team Commander' }] }],
      }],
    }, { ...defaultMeta, sectionOrder: ['custom:cs1'] }))
    expect(xml).toContain('Team Commander')
  })

  it('renders nested work roles in the Sidebar rail when work is assigned left', async () => {
    const xml = await documentXml(buildDocx(dataWithWorkRoles, { ...defaultMeta, templateId: 'sidebar', columnAssignment: { work: 'left' } }))
    expect(xml).toContain('Data Team Lead')
  })
})
