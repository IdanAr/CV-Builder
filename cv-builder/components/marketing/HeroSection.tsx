import Link from 'next/link'
import { Upload, Sparkles } from 'lucide-react'
import { TemplateThumbnail } from './TemplateThumbnail'

export function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI-powered resume builder
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
            Create a{' '}
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Job-Winning CV
            </span>{' '}
            in Minutes
          </h1>
          <p className="mt-6 text-lg text-gray-600 max-w-xl">
            Use our AI-powered CV builder to craft an ATS-optimized resume that gets you hired faster. Choose from
            professional templates and beat the resume robots.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signin"
              className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-base font-semibold text-white shadow-md transition hover:opacity-90"
            >
              Build My CV Now
            </Link>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white/70 px-6 py-3 text-base font-semibold text-indigo-700 backdrop-blur-xl transition hover:bg-indigo-50"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Sign Up to Upload Your CV
            </Link>
          </div>
        </div>
        <div className="relative mx-auto">
          <TemplateThumbnail
            templateId="modern"
            height={480}
            className="rotate-2 max-w-full"
            data-testid="hero-thumbnail"
          />
          <div
            className="absolute -bottom-4 -left-4 rounded-xl bg-white px-4 py-2 shadow-lg border border-green-100"
          >
            <p className="text-xs font-medium text-gray-500">ATS Score</p>
            <p className="text-2xl font-bold text-green-600">95%</p>
          </div>
        </div>
      </div>
    </section>
  )
}
