import Link from 'next/link'
import { TemplateThumbnail, type MarketingTemplateId } from './TemplateThumbnail'

const TEMPLATES: { id: MarketingTemplateId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'modern', label: 'Modern' },
  { id: 'executive', label: 'Executive' },
  { id: 'sidebar', label: 'Sidebar' },
]

export function TemplatesShowcaseSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Templates Designed by Recruiters</h2>
      <div className="mt-10 flex gap-6 overflow-x-auto pb-4 snap-x">
        {TEMPLATES.map(({ id, label }) => (
          <div key={id} className="shrink-0 snap-start text-center">
            <TemplateThumbnail templateId={id} height={360} />
            <p className="mt-3 text-sm font-medium text-gray-700">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/signin"
          className="inline-block rounded-lg border border-indigo-200 bg-white/70 px-6 py-3 text-base font-semibold text-indigo-700 backdrop-blur-xl transition hover:bg-indigo-50"
        >
          Preview All Templates
        </Link>
      </div>
    </section>
  )
}
