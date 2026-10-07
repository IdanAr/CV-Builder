'use client'
import { Button } from '@/components/ui/Button'

export interface ProfileOption {
  _id: string
  name: string
  isActive: boolean
}

interface PipelineFiltersProps {
  profiles: ProfileOption[]
  profile: string | null
  q: string
  onProfileChange(id: string | null): void
  onQueryChange(q: string): void
  scanning: boolean
  onScan(): void
  scanLabel: string
}

const FIELD =
  'min-h-10 rounded-control border border-border bg-surface px-3 text-sm text-fg-body sm:min-h-8 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function PipelineFilters({
  profiles, profile, q, onProfileChange, onQueryChange, scanning, onScan, scanLabel,
}: PipelineFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-sm text-fg-muted">
        <span>Profile</span>
        <select
          value={profile ?? ''}
          onChange={(e) => onProfileChange(e.target.value || null)}
          className={FIELD}
        >
          <option value="">All profiles</option>
          {profiles.map((p) => (
            <option key={p._id} value={p._id}>
              {p.name}
              {p.isActive ? '' : ' (paused)'}
            </option>
          ))}
        </select>
      </label>
      <label className="min-w-40 flex-1">
        <span className="sr-only">Search jobs</span>
        <input
          type="search"
          value={q}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search jobs"
          className={`w-full ${FIELD}`}
        />
      </label>
      <Button variant="secondary" size="md" className="sm:min-h-8" onClick={onScan} disabled={scanning}>
        {scanning ? 'Scanning…' : scanLabel}
      </Button>
    </div>
  )
}
