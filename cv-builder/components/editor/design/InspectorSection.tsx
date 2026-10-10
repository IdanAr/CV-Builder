'use client'

import { useId, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Collapsible } from '@/components/ui/motion/Collapsible'
import { cn } from '@/lib/utils'

interface InspectorSectionProps {
  title: string
  icon: ReactNode
  /** What is set right now, readable without opening the section. */
  summary: ReactNode
  open: boolean
  onToggle: () => void
  children: ReactNode
}

/**
 * One collapsible row of the Design panel. Closed, it is a single line that
 * still tells the user what is set (the summary); open, it shows the controls.
 * The panel keeps at most one of these open, so it stays short.
 */
export function InspectorSection({ title, icon, summary, open, onToggle, children }: InspectorSectionProps) {
  const id = useId()
  const reduceMotion = useReducedMotion()
  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn(
        'rounded-card border bg-surface transition-colors',
        open ? 'border-border' : 'border-border-subtle hover:border-border'
      )}
    >
      <h2 id={`${id}-title`} className="m-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
          className="flex min-h-12 w-full items-center gap-3 rounded-card px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-control transition-colors',
              open ? 'bg-surface-selected text-primary' : 'bg-surface-subtle text-fg-muted'
            )}
          >
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-fg-heading">{title}</span>
            <span className="block truncate text-xs text-fg-muted">{summary}</span>
          </span>
          <motion.span
            aria-hidden="true"
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="flex text-fg-subtle"
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </button>
      </h2>
      <div id={`${id}-body`}>
        <Collapsible open={open}>
          <div className="border-t border-border-subtle px-3 pb-4 pt-3">{children}</div>
        </Collapsible>
      </div>
    </section>
  )
}
