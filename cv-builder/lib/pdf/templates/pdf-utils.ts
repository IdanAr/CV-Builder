import type { ResumeMeta } from '@/lib/schemas/resume.zod'

export function mapToPdfFont(font: string): string {
  const serifFonts = ['Garamond', 'Georgia', 'Cambria']
  return serifFonts.includes(font) ? 'Times-Roman' : 'Helvetica'
}

export function inToPt(inches: number): number {
  return inches * 72
}

export function formatContact(basics: {
  email?: string
  phone?: string
  location?: { city?: string; region?: string }
}): string {
  const location = [basics.location?.city, basics.location?.region].filter(Boolean).join(', ')
  return [basics.email, basics.phone, location].filter(Boolean).join(' · ')
}

export const DEFAULT_SECTION_ORDER = [
  'work', 'education', 'skills', 'volunteer', 'languages',
]

export function resolveSectionOrder(meta: ResumeMeta): string[] {
  return meta.sectionOrder?.length > 0 ? meta.sectionOrder : DEFAULT_SECTION_ORDER
}
