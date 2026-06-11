export type ExportMode = 'ats' | 'designed'

// Invalid/missing values fall back to 'designed' (backward compatible:
// requests without a mode behave exactly as before this feature existed).
export function parseExportMode(value: unknown): ExportMode {
  return value === 'ats' ? 'ats' : 'designed'
}
