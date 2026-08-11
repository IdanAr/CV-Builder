import type { ResumeData } from './schemas/resume.zod'

type Basics = NonNullable<ResumeData['basics']>
type Profile = NonNullable<Basics['profiles']>[number]

/**
 * Resolves the list of profile links to render, falling back to the legacy
 * basics.url when profiles is empty. Every render surface must go through
 * this — not read basics.profiles directly — so a résumé's website link
 * doesn't disappear until the user has opened the editor once to trigger
 * BasicsForm's in-memory migration from basics.url to basics.profiles.
 */
export function resolveProfiles(basics: Basics | undefined): Profile[] {
  if (!basics) return []
  if (basics.profiles && basics.profiles.length > 0) return basics.profiles
  if (basics.url) return [{ id: 'legacy-url', url: basics.url }]
  return []
}
