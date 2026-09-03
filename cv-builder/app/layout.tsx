import type { Metadata } from 'next'
// The app's UI typeface. `globals.css` has always declared `font-family: Inter`
// on `body`, but nothing ever loaded the face — the eight other `@fontsource`
// packages in package.json are résumé/PDF faces served through `fontFaceCss()`,
// not UI ones — so every visitor without Inter installed locally silently fell
// back to `system-ui`.
//
// Self-hosted from node_modules rather than `next/font/google`: the latter
// fetches from fonts.gstatic.com at build time, which makes the production
// build fail on any network-restricted builder. This also matches how every
// other font in this repo is sourced. One variable file covers weights 100-900
// and the package already sets `font-display: swap`.
import '@fontsource-variable/inter'
import './globals.css'
import { Toaster } from '@/components/ui/Toaster'
import { SkipLink } from '@/components/ui/SkipLink'
import { fontFaceCss } from '@/lib/fonts/families'
import { resolveSiteUrl } from '@/lib/site-url'

// Everything a link needs to render as something other than a bare URL.
// `metadataBase` is the piece that unlocks the rest: without it Next emits the
// Open Graph image as a root-relative path, which crawlers cannot resolve, so
// `app/opengraph-image.tsx` would be generated and then never used.
export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteUrl()),
  // `default` is what the marketing page and any route without its own title
  // shows; `template` frames the rest, so the editor reads "My CV · CV Builder"
  // in a tab strip rather than an unattributed document name.
  title: {
    default: 'CV Builder — AI-assisted résumé builder',
    template: '%s · CV Builder',
  },
  description:
    'Write a résumé that gets past the filter. AI drafting, ATS scoring against a real job description, and PDF or DOCX export.',
  applicationName: 'CV Builder',
  keywords: ['resume builder', 'CV builder', 'ATS', 'cover letter', 'job application tracker'],
  openGraph: {
    type: 'website',
    siteName: 'CV Builder',
    title: 'CV Builder — AI-assisted résumé builder',
    description:
      'AI drafting, ATS scoring against a real job description, and PDF or DOCX export.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CV Builder — AI-assisted résumé builder',
    description:
      'AI drafting, ATS scoring against a real job description, and PDF or DOCX export.',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss() }} />
      </head>
      <body className="min-h-screen antialiased">
        {/* WCAG 2.4.1 Bypass Blocks. Every page here renders the same navbar
            ahead of its content — on the dashboard that is seven action items —
            so a keyboard or screen-reader user had to walk the whole bar again
            on every navigation. First element in the body, hidden until it
            takes focus, pointing at the `main` landmark each route provides. */}
        <SkipLink />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
