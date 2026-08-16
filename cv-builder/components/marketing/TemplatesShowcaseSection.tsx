import Link from 'next/link'
import { TemplateThumbnail, type MarketingTemplateId } from './TemplateThumbnail'
import { Marquee } from './Marquee'

const TEMPLATES: {
  id: MarketingTemplateId
  label: string
  colors: { primaryColor: string; accentColor: string }
}[] = [
  { id: 'classic', label: 'Classic', colors: { primaryColor: '#1e293b', accentColor: '#0369a1' } },
  { id: 'minimal', label: 'Minimal', colors: { primaryColor: '#18181b', accentColor: '#0d9488' } },
  { id: 'modern', label: 'Modern', colors: { primaryColor: '#312e81', accentColor: '#7c3aed' } },
  { id: 'executive', label: 'Executive', colors: { primaryColor: '#1c1917', accentColor: '#b45309' } },
  { id: 'sidebar', label: 'Sidebar', colors: { primaryColor: '#064e3b', accentColor: '#059669' } },
]

export function TemplatesShowcaseSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Templates Designed by Recruiters</h2>
      <div className="mt-10">
        <Marquee
          ariaLabel="Template previews"
          durationSeconds={45}
          items={TEMPLATES.map(({ id, label, colors }) => (
            <div key={id} className="text-center">
              <TemplateThumbnail templateId={id} height={360} colors={colors} />
              <p className="mt-3 text-sm font-medium text-gray-700">{label}</p>
            </div>
          ))}
        />
      </div>
      <div className="mt-8 text-center">
        <Link
          href="/signin"
          className="inline-block rounded-lg border border-indigo-200 bg-white/70 px-6 py-3 text-base font-semibold text-indigo-700 backdrop-blur-xl transition hover:bg-indigo-50"
        >
          Sign Up to Browse Templates
        </Link>
      </div>
    </section>
  )
}
