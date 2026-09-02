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
import { fontFaceCss } from '@/lib/fonts/families'

export const metadata: Metadata = {
  title: 'CV Builder',
  description: 'AI-powered CV builder with ATS optimization',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style dangerouslySetInnerHTML={{ __html: fontFaceCss() }} />
      </head>
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
