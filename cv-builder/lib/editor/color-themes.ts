/**
 * Curated primary + accent pairs for the Design panel's Colors section. Like
 * the font pairings and spacing presets, a theme is not stored: it is
 * recognised by value, so a CV whose two colours happen to match a theme
 * shows that theme selected, and anything else reads as "Custom".
 *
 * Primary colours the name, headings and (on Sidebar) the rail; accent colours
 * links, rules and job titles. Every primary is dark enough for white rail
 * text and every accent keeps at least 4.5:1 against white paper.
 */
export interface ColorTheme {
  id: string
  label: string
  primary: string
  accent: string
}

export const COLOR_THEMES: ColorTheme[] = [
  { id: 'classic', label: 'Classic', primary: '#000000', accent: '#0066cc' },
  { id: 'midnight', label: 'Midnight', primary: '#1e2a44', accent: '#2457f5' },
  { id: 'graphite', label: 'Graphite', primary: '#1f2937', accent: '#4b5563' },
  { id: 'ocean', label: 'Ocean', primary: '#0c4a6e', accent: '#0e7490' },
  { id: 'forest', label: 'Forest', primary: '#14532d', accent: '#15803d' },
  { id: 'teal', label: 'Teal', primary: '#134e4a', accent: '#0f766e' },
  { id: 'burgundy', label: 'Burgundy', primary: '#4c0519', accent: '#9f1239' },
  { id: 'plum', label: 'Plum', primary: '#3b0764', accent: '#7c3aed' },
  { id: 'copper', label: 'Copper', primary: '#431407', accent: '#c2410c' },
  { id: 'slate', label: 'Slate', primary: '#0f172a', accent: '#475569' },
]

export function matchColorTheme(primary: string, accent: string): ColorTheme | undefined {
  const p = primary.toLowerCase()
  const a = accent.toLowerCase()
  return COLOR_THEMES.find((t) => t.primary === p && t.accent === a)
}
