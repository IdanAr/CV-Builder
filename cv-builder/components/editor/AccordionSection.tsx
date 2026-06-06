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
}

export function AccordionSection({
  title,
  badge,
  isOpen,
  onToggle,
  children,
  onMoveUp,
  onMoveDown,
}: AccordionSectionProps) {
  return (
    <div className="border border-indigo-100 rounded-xl overflow-hidden bg-white/60 backdrop-blur-sm shadow-sm">
      <div className="flex items-center gap-1 pr-2 bg-white/70 hover:bg-white/90 transition-colors">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex-1 flex items-center gap-2 px-4 py-3 text-left min-w-0"
        >
          <span className="font-medium text-sm text-indigo-900">{title}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-500">
              {badge}
            </span>
          )}
        </button>
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
        <span aria-hidden="true" className="text-indigo-300 text-xs px-3">
          {isOpen ? '▲' : '▼'}
        </span>
      </div>
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t border-indigo-100 bg-white/50">{children}</div>
      )}
    </div>
  )
}
