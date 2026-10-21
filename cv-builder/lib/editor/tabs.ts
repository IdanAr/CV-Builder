// The editor's top-level tabs. Kept out of EditorShell (a client module) so the
// server page can validate `?tab=` with the same list the shell renders.
export const EDITOR_TABS = ['edit', 'design', 'ats', 'coverLetter'] as const

export type EditorTab = (typeof EDITOR_TABS)[number]

/** The tab named by a `?tab=` value, or 'edit' for a missing or unknown one. */
export function parseEditorTab(value: string | string[] | undefined): EditorTab {
  const first = Array.isArray(value) ? value[0] : value
  return EDITOR_TABS.find((tab) => tab === first) ?? 'edit'
}
