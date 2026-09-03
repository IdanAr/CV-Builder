import { ImageResponse } from 'next/og'
import { BRAND_MARK_DATA_URI } from '@/lib/brand/mark'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

/**
 * The home-screen icon iOS uses when someone saves the app to their dock.
 * Generated rather than checked in because Next's `apple-icon` file convention
 * accepts only raster formats — unlike `icon`, it will not serve the SVG in
 * `app/icon.svg`, so the same mark has to be rasterised here.
 *
 * The mark already carries its own violet plate and corner radius, so it fills
 * the frame edge to edge; iOS applies its own mask on top.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex' }}>
        <img src={BRAND_MARK_DATA_URI} width={180} height={180} alt="" />
      </div>
    ),
    size
  )
}
