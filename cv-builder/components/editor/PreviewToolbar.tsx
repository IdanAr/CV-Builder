'use client'

import type { ReactNode } from 'react'
import { Popover } from '@/components/ui/Popover'

export interface PreviewToolbarProps {
  pageText: string
  formatScore: number
  /** 'Fit' or 'NN%' */
  zoomLabel: string
  canZoomIn: boolean
  canZoomOut: boolean
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  fitActive: boolean
  /** Preset listbox rendered inside the zoom-percentage popover. */
  zoomMenu: ReactNode
  zoomMenuOpen?: boolean
  onZoomMenuOpenChange?: (open: boolean) => void
  expandable?: boolean
  expanded?: boolean
  onToggleExpand?: () => void
}

const BTN =
  'flex min-h-10 min-w-10 items-center justify-center rounded-control text-sm text-fg-body transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent'

export function PreviewToolbar({
  pageText,
  formatScore,
  zoomLabel,
  canZoomIn,
  canZoomOut,
  onZoomIn,
  onZoomOut,
  onFit,
  fitActive,
  zoomMenu,
  zoomMenuOpen = false,
  onZoomMenuOpenChange = () => {},
  expandable = false,
  expanded = false,
  onToggleExpand,
}: PreviewToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Preview controls"
      className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-surface px-3"
    >
      {/* Visible text hides below sm so the controls fit a phone; the
          live-region mirror stays for screen readers at every width. */}
      <span className="hidden min-w-0 truncate text-xs font-medium text-fg-muted sm:block">
        {pageText}
      </span>
      <span aria-live="polite" className="sr-only">
        {pageText}
      </span>
      <span
        aria-label={`ATS format score ${formatScore} out of 100`}
        className="shrink-0 whitespace-nowrap rounded-chip bg-surface-subtle px-2 py-0.5 text-xs font-medium text-fg-body"
      >
        ATS format {formatScore}
      </span>
      <div className="flex-1" />
      <button
        type="button"
        aria-label="Zoom out"
        data-testid="zoom-out"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        className={BTN}
      >
        −
      </button>
      <Popover
        open={zoomMenuOpen}
        onOpenChange={onZoomMenuOpenChange}
        trigger={
          <button
            type="button"
            aria-haspopup="listbox"
            aria-expanded={zoomMenuOpen}
            data-testid="zoom-percentage"
            className={`${BTN} px-2 text-xs tabular-nums`}
          >
            {zoomLabel}
          </button>
        }
      >
        {zoomMenu}
      </Popover>
      <button
        type="button"
        aria-label="Zoom in"
        data-testid="zoom-in"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        className={BTN}
      >
        +
      </button>
      <button
        type="button"
        aria-pressed={fitActive}
        aria-label="Fit width"
        title="Fit width"
        onClick={onFit}
        className={`${BTN} px-2 text-xs ${fitActive ? 'bg-surface-subtle font-medium' : ''}`}
      >
        <span aria-hidden="true" className="sm:hidden">
          ↔
        </span>
        <span aria-hidden="true" className="hidden sm:inline">
          Fit width
        </span>
      </button>
      {expandable && (
        <button
          type="button"
          onClick={onToggleExpand}
          aria-pressed={expanded}
          title={expanded ? 'Collapse preview' : 'Expand preview'}
          aria-label={expanded ? 'Collapse preview' : 'Expand preview'}
          className={`${BTN} ${expanded ? 'bg-surface-subtle' : ''}`}
        >
          ⛶
        </button>
      )}
    </div>
  )
}
