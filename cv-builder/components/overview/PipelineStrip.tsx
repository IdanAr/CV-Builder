import Link from 'next/link'
import { PIPELINE_STAGES, STAGE_LABELS, type PipelineStage } from '@/lib/jobsearch/stages'
import type { PipelineCounts } from '@/lib/api/scraped-jobs'
import { cn } from '@/lib/utils'

/** Stages that ask something of the user when non-empty. */
const ATTENTION_STAGES: readonly PipelineStage[] = ['matched', 'drafted', 'ready']

export function PipelineStrip({ counts }: { counts: PipelineCounts }) {
  return (
    <section aria-labelledby="overview-pipeline">
      <h2 id="overview-pipeline" className="mb-3 text-base font-medium text-fg-heading">
        Job search pipeline
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {PIPELINE_STAGES.map((stage) => {
          const count = counts[stage]
          const attention = ATTENTION_STAGES.includes(stage) && count > 0
          return (
            <Link
              key={stage}
              href={`/dashboard/jobsearch?stage=${stage}`}
              aria-label={`${STAGE_LABELS[stage]} ${count}`}
              className={cn(
                'rounded-card border bg-surface p-3',
                attention ? 'border-border-attention' : 'border-border'
              )}
            >
              <div className="text-xl font-medium tabular-nums text-fg-heading">{count}</div>
              <div className="text-xs text-fg-muted">{STAGE_LABELS[stage]}</div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
