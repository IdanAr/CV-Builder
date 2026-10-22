/**
 * Maps a picker font to one Word has on every machine. The résumé and the cover
 * letter DOCX builders share it, so both files fall back the same way.
 */
export function mapFont(font: string): string {
  const map: Record<string, string> = {
    'Lato': 'Arial',
    'Roboto': 'Arial',
    'IBM Plex Sans': 'Calibri',
    'Helvetica': 'Arial',
  }
  return map[font] ?? font
}
