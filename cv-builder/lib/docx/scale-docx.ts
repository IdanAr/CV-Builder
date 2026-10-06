import JSZip from 'jszip'

/**
 * `meta.fontScale` for DOCX. The exporter writes explicit half-point sizes at
 * ~100 sites, so instead of threading a factor through each one this rewrites
 * every run-size element (`<w:sz w:val>` and `<w:szCs w:val>`) in the finished
 * package. Border widths use a `w:sz` *attribute*, not this element, and are
 * left alone. At scale 1 the input is returned as-is so existing exports stay
 * byte-identical.
 */
const SIZE_ELEMENT = /(<w:(?:sz|szCs) w:val=")(\d+)(")/g
const PARTS = /^word\/(document|styles|numbering|header\d*|footer\d*)\.xml$/

export async function applyFontScaleToDocx(buffer: Uint8Array, scale: number): Promise<Buffer> {
  if (scale === 1) return Buffer.from(buffer)
  const zip = await JSZip.loadAsync(buffer)
  for (const name of Object.keys(zip.files)) {
    if (!PARTS.test(name)) continue
    const xml = await zip.file(name)!.async('string')
    const scaled = xml.replace(SIZE_ELEMENT, (_m, open: string, n: string, close: string) =>
      `${open}${Math.max(2, Math.round(Number(n) * scale))}${close}`)
    zip.file(name, scaled)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
