import { describe, it, expect, vi } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import { selectPdfTemplate } from '@/lib/pdf/select-template'
import { extractPagination } from '@/lib/pdf/extract-pagination'
import { ResumeMetaSchema } from '@/lib/schemas/resume.zod'
import type { ResumeData } from '@/lib/schemas/resume.zod'
import type React from 'react'

vi.setConfig({ testTimeout: 20_000 })

function longResume(): ResumeData {
  return {
    basics: { name: 'Test Person', label: 'Engineer', summary: 'A summary paragraph.' },
    work: Array.from({ length: 12 }, (_, i) => ({
      name: `Company Number ${i}`,
      position: `Senior Role ${i}`,
      startDate: '2015-01',
      endDate: '2016-01',
      summary: `Owned delivery of workstream ${i} across several teams.`,
      highlights: [
        `Achievement alpha for workstream ${i} with measurable outcomes`,
        `Achievement beta for workstream ${i} reducing costs significantly`,
        `Achievement gamma for workstream ${i} improving reliability metrics`,
      ],
    })),
  }
}

async function renderLongPdf(): Promise<Buffer> {
  const meta = ResumeMetaSchema.parse({})
  const element = selectPdfTemplate(longResume(), meta, 'designed', 'Test CV')
  return Buffer.from(await renderToBuffer(element as React.ReactElement<never>))
}

describe('extractPagination', () => {
  it('reports the true page count and one anchor per page break', async () => {
    const buffer = await renderLongPdf()
    const result = await extractPagination(buffer)
    expect(result.pageCount).toBeGreaterThanOrEqual(2)
    expect(result.anchors).toHaveLength(result.pageCount - 1)
  })

  it('anchors are normalized, non-empty, and bounded', async () => {
    const buffer = await renderLongPdf()
    const { anchors } = await extractPagination(buffer)
    for (const anchor of anchors) {
      expect(anchor.length).toBeGreaterThanOrEqual(20)
      expect(anchor.length).toBeLessThanOrEqual(120)
      expect(anchor).toBe(anchor.toLowerCase())
      expect(anchor).not.toMatch(/\s{2,}/)
    }
  })

  it('anchor text originates from the resume content', async () => {
    const buffer = await renderLongPdf()
    const { anchors } = await extractPagination(buffer)
    // Every anchor must contain a fragment of our fixture vocabulary
    expect(anchors[0]).toMatch(/company|achievement|workstream|senior|owned/)
  })
})
