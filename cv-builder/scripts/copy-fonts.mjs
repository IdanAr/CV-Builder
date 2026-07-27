// Copies the latin .woff faces out of node_modules/@fontsource into
// public/fonts so the browser preview loads the same bytes the PDF embeds.
import { mkdirSync, copyFileSync } from 'node:fs'
import path from 'node:path'

const SLUGS = ['carlito', 'caladea', 'arimo', 'gelasio', 'eb-garamond',
               'lato', 'roboto', 'ibm-plex-sans']
const WEIGHTS = [400, 700]
// ExecutiveTemplate and ClassicTemplate both use `fontStyle: 'italic'` in the
// preview. Without a real italic face the browser synthesizes one by shearing
// the regular, while the PDF embeds the true italic — a preview/export
// divergence the text-parity test cannot see because it compares words, not
// styles.
const STYLES = ['normal', 'italic']

const dest = path.join(process.cwd(), 'public', 'fonts')
mkdirSync(dest, { recursive: true })

let copied = 0
for (const slug of SLUGS) {
  for (const weight of WEIGHTS) {
    for (const style of STYLES) {
      const file = `${slug}-latin-${weight}-${style}.woff`
      copyFileSync(
        path.join(process.cwd(), 'node_modules', '@fontsource', slug, 'files', file),
        path.join(dest, file)
      )
      copied++
    }
  }
}
console.log(`copied ${copied} font files to public/fonts`)
