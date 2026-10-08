import Link from 'next/link'
import { buttonClasses } from '@/components/ui/Button'

export function FinalCtaSection() {
  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-20 text-center">
      <div className="rounded-card bg-primary px-8 py-16">
        <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-primary-fg">Ready to land your dream job?</h2>
        <p className="mt-4 text-lg text-primary-fg/90">Join thousands of successful job seekers today.</p>
        <Link
          href="/signin"
          className={buttonClasses({ variant: 'secondary', size: 'md', className: 'mt-8 px-8 text-base' })}
        >
          Create Your Free CV
        </Link>
      </div>
    </section>
  )
}
