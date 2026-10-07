'use client'

import { useState } from 'react'
import { Popover } from '@/components/ui/Popover'

export const SHORTCUTS: ReadonlyArray<{ keys: string; label: string }> = [
  { keys: 'J / K', label: 'Move' },
  { keys: 'Enter', label: 'Open' },
  { keys: 'A', label: 'Primary action' },
  { keys: 'D', label: 'Dismiss' },
]

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false)
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          className="min-h-10 sm:min-h-6 rounded-control px-2 text-xs text-fg-subtle hover:bg-surface-subtle hover:text-fg-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Keyboard shortcuts
        </button>
      }
    >
      <div className="w-64 rounded-card border border-border bg-surface p-3 shadow-popover">
        <dl className="space-y-1.5 text-sm">
          {SHORTCUTS.map((s) => (
            <div key={s.keys} className="flex items-center justify-between gap-3">
              <dt>
                <kbd className="rounded border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-xs text-fg-body">
                  {s.keys}
                </kbd>
              </dt>
              <dd className="text-fg-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-fg-subtle">
          Shortcuts are optional; every action also has a button.
        </p>
      </div>
    </Popover>
  )
}
