'use client'

import type { ReactNode } from 'react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { Transform } from '@dnd-kit/utilities'
import { CSS } from '@dnd-kit/utilities'
import { motion, useReducedMotion } from 'framer-motion'
import { Collapsible } from '@/components/ui/motion/Collapsible'
import { X } from 'lucide-react'
import { buttonClasses } from '@/components/ui/Button'

export interface DragHandleProps {
  listeners: DraggableSyntheticListeners
  attributes: DraggableAttributes
  setNodeRef: (el: HTMLElement | null) => void
  transform: Transform | null
  transition: string | undefined
  isDragging: boolean
}

interface AccordionSectionProps {
  title: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  onRename?: (name: string) => void
  onDelete?: () => void
  dragHandleProps?: DragHandleProps
  icon?: ReactNode
}

export function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
  onRename,
  onDelete,
  dragHandleProps,
  icon,
}: AccordionSectionProps) {
  const reduceMotion = useReducedMotion()
  return (
    <div
      ref={dragHandleProps?.setNodeRef}
      style={{
        transform: CSS.Transform.toString(dragHandleProps?.transform ?? null),
        transition: dragHandleProps?.transition,
      }}
      className={`border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm transition-shadow duration-200 hover:shadow-md group${
        dragHandleProps?.isDragging ? ' opacity-60 border-dashed border-indigo-400' : ''
      }`}
    >
      {/* Header layout is a fixed left rail so the icon chip lands at the same
          x-position in every variant: [handle slot] [icon chip] [title/rename].
          Non-draggable sections (Personal Info) get a same-width spacer. */}
      <div className="flex items-center gap-1 pl-2 pr-2 bg-white/70 hover:bg-white/90 transition-colors">
        {dragHandleProps ? (
          <button
            type="button"
            className="w-5 shrink-0 py-3 text-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity cursor-grab text-fg-subtle hover:text-fg-body select-none"
            {...dragHandleProps.listeners}
            {...dragHandleProps.attributes}
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
        ) : (
          <span className="w-5 shrink-0" aria-hidden="true" />
        )}
        {icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-fg-muted">
            {icon}
          </span>
        )}
        {onRename ? (
          // The wrapper carries its own vertical padding (py-2) that the
          // input's own padding (py-1) doesn't cover, so a strip of the
          // wrapper above/below the input is real clickable space — not
          // occupied by the input — for toggling the section, matching the
          // full-width toggle built-in sections get from their <button>.
          // Combined height (py-2 + py-1 = 12px top/bottom) matches the
          // original single py-3 the input used to carry alone, so the
          // header's overall height is unchanged.
          //
          // The input's own onClick/onMouseDown stop propagation so a click
          // landing ON the input — the common case, since the input fills
          // most of the wrapper — only focuses it for editing and never
          // reaches the wrapper's onToggle. Without this, clicking into the
          // field to rename a section would also collapse/expand it as an
          // unwanted side effect.
          <div className="flex-1 min-w-0 py-2" onClick={onToggle}>
            <input
              type="text"
              value={title}
              onChange={(e) => onRename(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={`Rename ${title}`}
              className="w-full font-medium text-sm text-indigo-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2 py-1 min-w-0"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="flex-1 flex items-center px-2 py-3 text-left min-w-0"
          >
            <span className="font-medium text-sm text-indigo-900 truncate">{title}</span>
          </button>
        )}
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-fg-muted shrink-0">
            {badge}
          </span>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'h-6 w-6 text-fg-subtle hover:bg-surface-danger hover:text-fg-danger' })}
            aria-label={`Delete ${title}`}
          ><X aria-hidden="true" className="h-3.5 w-3.5" /></button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`Toggle ${title}`}
          className="text-fg-subtle text-xs px-3 py-3"
        >
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="inline-block"
          >
            ▼
          </motion.span>
        </button>
      </div>
      <Collapsible open={isOpen}>
        <div className="px-4 pb-4 pt-2 border-t border-indigo-100 bg-white/50">{children}</div>
      </Collapsible>
    </div>
  )
}
