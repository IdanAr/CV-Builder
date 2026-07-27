import type { Metadata } from 'next'
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
