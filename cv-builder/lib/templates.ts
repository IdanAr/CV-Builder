export const TEMPLATE_OPTIONS = [
  { id: 'classic', label: 'Classic', desc: 'Clean, professional, thin dividers' },
  { id: 'modern', label: 'Modern', desc: 'Bold header block, accent titles' },
  { id: 'minimal', label: 'Minimal', desc: 'Typography-only, maximum ATS compatibility' },
  { id: 'executive', label: 'Executive', desc: 'Serif, double-rule header, senior industries' },
  { id: 'sidebar', label: 'Sidebar', desc: 'Colored left rail, skills & languages in panel' },
]

export function templateLabel(id: string | undefined): string {
  return (TEMPLATE_OPTIONS.find((t) => t.id === id) ?? TEMPLATE_OPTIONS[0]).label
}
