import type { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { PlasmaBackground } from '@/components/ui/PlasmaBackground'
import { HeroSection } from '@/components/marketing/HeroSection'
import { FeaturesSection } from '@/components/marketing/FeaturesSection'
import { TemplatesShowcaseSection } from '@/components/marketing/TemplatesShowcaseSection'
import { HowItWorksSection } from '@/components/marketing/HowItWorksSection'
import { TestimonialsSection } from '@/components/marketing/TestimonialsSection'
import { FaqSection } from '@/components/marketing/FaqSection'
import { FinalCtaSection } from '@/components/marketing/FinalCtaSection'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { MarketingNavActions } from '@/components/marketing/MarketingNavActions'

export const metadata: Metadata = {
  title: 'Free AI CV Builder & Resume Maker | ATS-Friendly Templates',
  description:
    'Build a professional, ATS-optimized CV in minutes. Use AI to write bullet points, generate cover letters, and track your job applications. Try it for free!',
}

export default async function Home() {
  const session = await auth()

  return (
    <PlasmaBackground>
      <AppNavbar
        homeHref="/"
        containerClassName="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        actions={<MarketingNavActions isSignedIn={!!session} />}
      />
      <main>
        <HeroSection />
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
