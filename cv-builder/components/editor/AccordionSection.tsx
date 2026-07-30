'use client'

import type { ReactNode } from 'react'
import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core'
import type { Transform } from '@dnd-kit/utilities'
import { CSS } from '@dnd-kit/utilities'
import { motion, useReducedMotion } from 'framer-motion'
import { Collapsible } from '@/components/ui/motion/Collapsible'

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
            className="w-5 shrink-0 py-3 text-center opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-indigo-300 hover:text-indigo-500 select-none"
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
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
            {icon}
          </span>
        )}
        {onRename ? (
          <input
            type="text"
            value={title}
            onChange={(e) => onRename(e.target.value)}
            aria-label={`Rename ${title}`}
            className="flex-1 font-medium text-sm text-indigo-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-2 py-3 min-w-0"
          />
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
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 shrink-0">
            {badge}
          </span>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-gray-400 hover:text-red-500 rounded"
            aria-label="Delete section"
          >
            ✕
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-label={`Toggle ${title}`}
          className="text-indigo-300 text-xs px-3 py-3"
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
