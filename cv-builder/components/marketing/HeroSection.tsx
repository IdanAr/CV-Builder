import Link from 'next/link'
import { buttonClasses } from '@/components/ui/Button'
import { Upload, Sparkles, Check } from 'lucide-react'
import { TemplateThumbnail } from './TemplateThumbnail'

export function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-selected px-3 py-1 text-sm font-medium text-fg-body">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            AI-powered resume builder
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-fg-heading">
            Create a{' '}
            <span className="text-primary">
              Job-Winning CV
            </span>{' '}
            in Minutes
          </h1>
          <p className="mt-6 text-lg text-fg-body max-w-xl">
            Use our AI-powered CV builder to craft an ATS-optimized resume that gets you hired faster. Choose from
            professional templates and beat the resume robots.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/signin"
              className={buttonClasses({ variant: 'primary', size: 'md', className: 'px-6 text-base' })}
            >
              Build My CV Now
            </Link>
            <Link
              href="/signin"
              className={buttonClasses({ variant: 'secondary', size: 'md', className: 'gap-2 px-6 text-base' })}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Sign Up to Upload Your CV
            </Link>
          </div>
          {/* Until this line, the only "Free" in the whole funnel was a word
              inside a button label in the very last section, so a visitor could
              not tell above the fold whether the product costs anything —
              exactly the question a CTA has to answer before it is clicked.

              Worded as "free to start" rather than "free forever": nothing here
              should promise a pricing model that has not been decided. */}
          <p className="mt-4 flex items-center gap-2 text-sm text-fg-body">
            <Check className="h-4 w-4 shrink-0 text-fg-success" aria-hidden="true" />
            Free to start, no credit card required
          </p>
        </div>
        <div className="relative mx-auto">
          <TemplateThumbnail
            templateId="modern"
            height={480}
            className="rotate-2 max-w-full"
            data-testid="hero-thumbnail"
          />
          <div
            className="absolute -bottom-4 -left-4 rounded-card border border-border bg-surface px-4 py-2 shadow-popover"
            aria-hidden="true"
          >
            <p className="text-xs font-medium text-fg-muted">ATS Score</p>
            <p className="text-2xl font-medium text-fg-success">95%</p>
          </div>
        </div>
      </div>
    </section>
  )
}
