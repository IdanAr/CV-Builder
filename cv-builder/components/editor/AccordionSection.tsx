'use client'

import type { ReactNode } from 'react'

interface AccordionSectionProps {
  title: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
  onMoveUp?: () => void
  onMoveDown?: () => void
  onRename?: (name: string) => void
  onDelete?: () => void
}

export function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
  onMoveUp,
  onMoveDown,
  onRename,
  onDelete,
}: AccordionSectionProps) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-1 pr-2 bg-white/70 hover:bg-white/90 transition-colors">
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
        {onMoveUp && (
          <button
            type="button"
            onClick={onMoveUp}
            className="p-1 text-indigo-300 hover:text-indigo-600 rounded"
            aria-label={`Move ${title} up`}
          >
            ↑
          </button>
        )}
        {onMoveDown && (
          <button
            type="button"
            onClick={onMoveDown}
            className="p-1 text-indigo-300 hover:text-indigo-600 rounded"
            aria-label={`Move ${title} down`}
          >
            ↓
          </button>
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
