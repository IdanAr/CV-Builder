import type { MetadataRoute } from 'next'
import { BRAND_VIOLET } from '@/lib/brand/mark'

/**
 * Makes the app installable and, more immediately, gives Android Chrome and
 * Windows a real name and colour instead of the URL and a white bar.
 *
 * `display: 'standalone'` rather than `browser`: the editor is a full-screen
 * workspace, and the browser chrome adds nothing once you are inside it.
 * `start_url` points at the dashboard, not the marketing page — anyone who has
 * installed the app has already signed up, and the router sends them to sign-in
 * if the session has lapsed.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'CV Builder',
    short_name: 'CV Builder',
    description: 'AI-assisted résumé builder with ATS scoring and PDF/DOCX export.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: BRAND_VIOLET,
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any' },
      { src: '/apple-icon', type: 'image/png', sizes: '180x180' },
    ],
  }
}
