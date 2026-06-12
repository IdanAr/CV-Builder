const LEFT_DEFAULTS = new Set(['work', 'education', 'volunteer'])

export const SIDEBAR_COLUMN_DEFAULTS: Record<string, 'left' | 'right'> = {
  skills: 'left',
  languages: 'left',
}

export function getColumnSide(
  section: string,
  columnAssignment: Record<string, 'left' | 'right'>,
  templateDefaults?: Record<string, 'left' | 'right'>,
): 'left' | 'right' {
  if (columnAssignment[section]) return columnAssignment[section]
  if (templateDefaults) return templateDefaults[section] ?? 'right'
  if (LEFT_DEFAULTS.has(section) || section.startsWith('custom:')) return 'left'
  return 'right'
}
