const LEFT_DEFAULTS = new Set(['work', 'education', 'volunteer'])

export function getColumnSide(
  section: string,
  columnAssignment: Record<string, 'left' | 'right'>,
): 'left' | 'right' {
  const override = columnAssignment[section]
  if (override) return override
  if (LEFT_DEFAULTS.has(section) || section.startsWith('custom:')) return 'left'
  return 'right'
}
