// Turns one AtsFix into a ResumeData patch — extracted from
// AtsScorePanel.tsx's applyFix so the same logic can run server-side (no
// Zustand store) inside the semi-auto apply pipeline (lib/jobsearch/apply.ts).
// The two call sites must never diverge: whichever field (roles[] vs. the
// legacy top-level highlights) a work entry currently uses is determined by
// fix.roleIndex, set upstream by ats-fix-pipeline.ts's buildEditableSections.
import type { ResumeData } from '@/lib/schemas/resume.zod'
import type { AtsFix } from './ats-fix-pipeline'

export function applyAtsFixToResumeData(data: ResumeData, fix: AtsFix): Partial<ResumeData> {
  if (fix.section === 'summary') {
    return { basics: { ...data.basics, summary: fix.suggested } }
  }

  if (fix.section === 'work' && fix.workIndex !== undefined && fix.highlightIndex !== undefined) {
    const work = (data.work ?? []).map((job, wi) => {
      if (wi !== fix.workIndex) return job
      // Highlights live in roles[] once a work entry has been edited
      // through the current editor UI (which clears the legacy top-level
      // fields entirely on save) — fix.roleIndex tells us which side of
      // that split to write back into.
      if (fix.roleIndex !== undefined) {
        const roles = (job.roles ?? []).map((role, ri) => {
          if (ri !== fix.roleIndex) return role
          const highlights = (role.highlights ?? []).map((h, hi) =>
            hi === fix.highlightIndex ? fix.suggested : h
          )
          return { ...role, highlights }
        })
        return { ...job, roles }
      }
      const highlights = (job.highlights ?? []).map((h, hi) =>
        hi === fix.highlightIndex ? fix.suggested : h
      )
      return { ...job, highlights }
    })
    return { work }
  }

  return {}
}
