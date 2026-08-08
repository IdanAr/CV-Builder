import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { PlasmaBackground } from '@/components/ui/PlasmaBackground'
import { HeroSection } from '@/components/marketing/HeroSection'
import { SocialProofSection } from '@/components/marketing/SocialProofSection'
import { FeaturesSection } from '@/components/marketing/FeaturesSection'
import { TemplatesShowcaseSection } from '@/components/marketing/TemplatesShowcaseSection'
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection'
import { TestimonialsSection } from '@/components/marketing/TestimonialsSection'
import { FaqSection } from '@/components/marketing/FaqSection'
import { FinalCtaSection } from '@/components/marketing/FinalCtaSection'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Free AI CV Builder & Resume Maker | ATS-Friendly Templates',
  description:
    'Build a professional, ATS-optimized CV in minutes. Use AI to write bullet points, generate cover letters, and track your job applications. Try it for free!',
}

export default async function Home() {
  const session = await auth()
  if (session) redirect('/dashboard')

  return (
    <PlasmaBackground>
      <AppNavbar
        homeHref="/"
        containerClassName="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        actions={
          <div className="flex items-center gap-3 flex-1">
            <Link href="/signin" className="ml-auto text-sm font-medium text-indigo-700 hover:text-indigo-900">
              Sign In
            </Link>
            <Link
              href="/signin"
              className="rounded-md bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              Get Started
            </Link>
          </div>
        }
      />
      <main>
        <HeroSection />
        <SocialProofSection />
        <FeaturesSection />
        <TemplatesShowcaseSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <FaqSection />
        <FinalCtaSection />
      </main>
      <MarketingFooter />
    </PlasmaBackground>
  )
}
