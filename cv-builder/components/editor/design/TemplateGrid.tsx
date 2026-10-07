'use client'

import { useId, useMemo, type ReactNode } from 'react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { CvThumbnail } from '@/components/cvs/CvThumbnail'
import { TEMPLATE_OPTIONS } from '@/lib/templates'
import { cn } from '@/lib/utils'

interface CardsProps {
  templateId: string
  renderThumb: (id: string) => ReactNode
}

function Cards({ templateId, renderThumb }: CardsProps) {
  const baseId = useId()
  const setMeta = useResumeEditorStore((s) => s.setMeta)
  return (
    <div role="group" aria-label="Template" className="grid grid-cols-2 gap-3">
      {TEMPLATE_OPTIONS.map((t) => {
        const active = templateId === t.id
        const labelId = `${baseId}-${t.id}-label`
        const descId = `${baseId}-${t.id}-desc`
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            aria-labelledby={labelId}
            aria-describedby={descId}
            onClick={() => {
              if (!active) setMeta({ templateId: t.id })
            }}
            className={cn(
              'rounded-card border bg-surface p-2 text-left transition-shadow',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-accent-600 ring-2 ring-accent-600'
                : 'border-border hover:border-accent-300 hover:shadow-sm'
            )}
          >
            {renderThumb(t.id)}
            <span id={labelId} className="mt-2 block text-sm font-medium text-fg">{t.label}</span>
            <span id={descId} className="block text-xs text-fg-muted">{t.desc}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Only mounted while the Design tab is visible, so its `data`/`meta`
 *  subscriptions and debounce start from the current values on open. */
function LiveCards({ templateId }: { templateId: string }) {
  const data = useResumeEditorStore((s) => s.data)
  const meta = useResumeEditorStore((s) => s.meta)
  // Thumbnails are static pictures of the user's own CV: re-render them from
  // the debounced values, never on every keystroke.
  const debouncedData = useDebounce(data, 300)
  const debouncedMeta = useDebounce(meta, 300)
  // Key on everything except templateId so that picking a template does not
  // hand every memoised thumbnail a fresh meta object.
  const { templateId: _ignored, ...rest } = debouncedMeta
  void _ignored
  const restKey = JSON.stringify(rest)
  const metaByTemplate = useMemo(() => {
    const base = JSON.parse(restKey) as Record<string, unknown>
    return Object.fromEntries(TEMPLATE_OPTIONS.map((t) => [t.id, { ...base, templateId: t.id }]))
  }, [restKey])

  return (
    <Cards
      templateId={templateId}
      renderThumb={(id) => <CvThumbnail data={debouncedData} meta={metaByTemplate[id]} scale={0.15} />}
    />
  )
}

/**
 * `active` is false while the Design tab is hidden. EditorShell keeps every tab
 * panel mounted, so without this the five full-CV thumbnails would re-render
 * (debounced) on every keystroke in the Edit tab. Inactive, the grid subscribes
 * only to `templateId` and shows neutral placeholders.
 */
export function TemplateGrid({ active = true }: { active?: boolean }) {
  const templateId = useResumeEditorStore((s) => s.meta.templateId)
  if (!active) {
    return (
      <Cards
        templateId={templateId}
        renderThumb={() => (
          <div aria-hidden="true" className="h-[140px] rounded-control bg-surface-muted" />
        )}
      />
    )
  }
  return <LiveCards templateId={templateId} />
}
