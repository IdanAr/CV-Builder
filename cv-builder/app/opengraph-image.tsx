import { ImageResponse } from 'next/og'
import { BRAND_MARK_DATA_URI, brandGradient } from '@/lib/brand/mark'

// Next reads these three exports to build the <meta property="og:*"> tags.
export const alt = 'CV Builder — AI-assisted résumé builder with ATS optimisation'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * The card every shared link renders as. Until this existed, a link to the app
 * — most often pasted into LinkedIn, which is where a résumé tool's links go —
 * unfurled as a bare URL with no image, title or description.
 *
 * `next/og` is used rather than a checked-in PNG so the card stays in step with
 * the brand mark, and because it needs no network: the runtime bundles
 * Geist-Regular.ttf, so no font is fetched at build time. That matters here —
 * `app/layout.tsx` documents why this repo self-hosts fonts instead of reaching
 * out to fonts.gstatic.com during a build.
 *
 * Satori (what ImageResponse renders through) supports only flexbox, so every
 * container below sets `display: flex` explicitly; a bare div with more than
 * one child throws rather than laying out.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: brandGradient,
          color: '#FFFFFF',
          fontFamily: 'Geist, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
            <img src={BRAND_MARK_DATA_URI} width={104} height={104} alt="" />
          <div style={{ display: 'flex', marginLeft: 28, fontSize: 44, fontWeight: 600, letterSpacing: -1 }}>
            CV Builder
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', fontSize: 82, lineHeight: 1.1, letterSpacing: -2.5 }}>
            Write a résumé that
          </div>
          <div style={{ display: 'flex', fontSize: 82, lineHeight: 1.1, letterSpacing: -2.5, color: '#C7D2FE' }}>
            gets past the filter.
          </div>
          <div style={{ display: 'flex', marginTop: 34, fontSize: 32, color: '#A5B4FC' }}>
            AI drafting · ATS scoring · PDF &amp; DOCX export
          </div>
        </div>
      </div>
    ),
    size
  )
}
