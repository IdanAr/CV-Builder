// Regenerates app/favicon.ico from the brand mark.
//
// Run with: npm run favicon:generate
//
// Why this exists rather than a hand-made binary: until this script, the
// favicon in app/favicon.ico was create-next-app's default — the Vercel
// triangle — committed untouched in the repo's first commit. Every browser tab
// the product has ever opened has been branded with the framework's logo.
//
// A .ico is kept alongside app/icon.svg because Safari only gained SVG-favicon
// support in 16.4; the .ico is what everything older falls back to. Both are
// generated from the same source in lib/brand/mark.ts, so they cannot drift.
//
// Not wired into prebuild like copy-fonts.mjs: the output is a committed
// binary that changes only when the mark does, and rasterising on every build
// would add a sharp dependency to CI for no benefit.
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'


const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// Rasterised from app/icon.svg rather than from lib/brand/mark.ts: the latter
// is TypeScript, and reading a string literal back out of source is exactly the
// kind of cleverness that breaks quietly. icon.svg is the canonical static
// copy, and lib/brand/__tests__/mark.test.ts fails if it ever stops matching
// the module — so this chain is guarded end to end.
const svg = readFileSync(join(root, 'app/icon.svg'))

// The 16px entry uses a reduced mark. At 16 square the hexagon and the plate
// are one violet step apart across roughly two pixels of edge, so the hexagon
// reads as noise rather than as a shape, and it crowds the spark down to an
// indistinct blob. Dropping it and enlarging the spark 1.8x about the centre
// leaves one white glyph on one violet ground — the only thing that survives.
//
// A literal rather than another export from lib/brand/mark.ts: nothing else in
// the app renders at 16px, so this reduction has exactly one consumer, and the
// module is better off describing only the mark people actually see.
const smallSvg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">' +
    '<rect width="100" height="100" rx="22" fill="#7C3AED"/>' +
    '<path d="M 28.4 39.2 L 44.6 39.2 L 50 28.4 L 55.4 39.2 L 71.6 39.2 L 60.8 55.4' +
    ' L 66.2 71.6 L 50 60.8 L 33.8 71.6 L 39.2 55.4 Z" fill="#FFFFFF"/>' +
    '</svg>'
)

// 16 and 32 are what browser tabs and bookmark bars actually request; 48 is
// the Windows taskbar; 64 covers 2x-density tab strips.
const SIZES = [16, 32, 48, 64]

const pngs = await Promise.all(
  SIZES.map((size) =>
    sharp(size <= 16 ? smallSvg : svg)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toBuffer()
  )
)

// ICO container. Entries carry PNG payloads rather than BMP — supported by
// every browser that matters here, and far smaller.
const HEADER = 6
const ENTRY = 16
const header = Buffer.alloc(HEADER)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // 1 = icon
header.writeUInt16LE(SIZES.length, 4)

let offset = HEADER + ENTRY * SIZES.length
const entries = SIZES.map((size, i) => {
  const e = Buffer.alloc(ENTRY)
  e.writeUInt8(size === 256 ? 0 : size, 0) // 0 encodes 256
  e.writeUInt8(size === 256 ? 0 : size, 1)
  e.writeUInt8(0, 2) // palette size, 0 for truecolour
  e.writeUInt8(0, 3) // reserved
  e.writeUInt16LE(1, 4) // colour planes
  e.writeUInt16LE(32, 6) // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8)
  e.writeUInt32LE(offset, 12)
  offset += pngs[i].length
  return e
})

const out = join(root, 'app/favicon.ico')
writeFileSync(out, Buffer.concat([header, ...entries, ...pngs]))
console.log(`app/favicon.ico — ${SIZES.join(', ')}px, ${Buffer.concat([header, ...entries, ...pngs]).length} bytes`)
