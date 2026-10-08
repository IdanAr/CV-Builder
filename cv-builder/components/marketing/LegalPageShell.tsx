// components/marketing/LegalPageShell.tsx
import type { ReactNode } from 'react'
import { AppNavbar } from '@/components/ui/AppNavbar'
import { PlasmaBackground } from '@/components/ui/PlasmaBackground'
import { MarketingNavActions } from './MarketingNavActions'
import { MarketingFooter } from './MarketingFooter'

interface LegalPageShellProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

/** Shared page chrome for public legal documents (Privacy Policy, Terms of Use). */
export function LegalPageShell({ title, lastUpdated, children }: LegalPageShellProps) {
  return (
    <PlasmaBackground>
      <AppNavbar homeHref="/" containerClassName="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" actions={<MarketingNavActions />} />
      <main id="main-content" className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-card border border-border bg-surface p-8 sm:p-12">
          <h1 className="text-xl font-medium text-fg-heading">{title}</h1>
          <p className="mt-2 text-xs text-fg-muted">Last updated: {lastUpdated}</p>
          <div className="mt-8 space-y-6 text-sm leading-relaxed text-fg-body">{children}</div>
        </div>
      </main>
      <MarketingFooter />
    </PlasmaBackground>
  )
}
