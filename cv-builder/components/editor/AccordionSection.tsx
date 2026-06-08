'use client'

import type { ReactNode } from 'react'
import type { DraggableAttributes, SyntheticListenerMap } from '@dnd-kit/core'
import type { Transform } from '@dnd-kit/utilities'
import { CSS } from '@dnd-kit/utilities'

export interface DragHandleProps {
  listeners: SyntheticListenerMap | undefined
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
}: AccordionSectionProps) {
  return (
    <div
      ref={dragHandleProps?.setNodeRef}
      style={{
        transform: CSS.Transform.toString(dragHandleProps?.transform ?? null),
        transition: dragHandleProps?.transition,
      }}
      className={`border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm group${
        dragHandleProps?.isDragging ? ' opacity-60 border-dashed border-indigo-400' : ''
      }`}
    >
      <div className="flex items-center gap-1 pr-2 bg-white/70 hover:bg-white/90 transition-colors">
        {dragHandleProps && (
          <button
            type="button"
            className="pl-2 pr-1 py-3 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab text-indigo-300 hover:text-indigo-500 select-none"
            {...dragHandleProps.listeners}
            {...dragHandleProps.attributes}
            aria-label="Drag to reorder"
          >
            ⠿
          </button>
        )}
        {onRename ? (
          <input
            type="text"
            value={title}
            onChange={(e) => onRename(e.target.value)}
            aria-label={`Rename ${title}`}
            className="flex-1 font-medium text-sm text-indigo-900 bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 rounded px-4 py-3 min-w-0"
          />
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isOpen}
            className="flex-1 flex items-center gap-2 px-4 py-3 text-left min-w-0"
          >
            <span className="font-medium text-sm text-indigo-900">{title}</span>
            {badge && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500 shrink-0">
                {badge}
              </span>
            )}
          </button>
        )}
        {onRename && badge && (
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
          {isOpen ? '▲' : '▼'}
        </button>
      </div>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-indigo-100 bg-white/50">{children}</div>
      )}
    </div>
  )
}
