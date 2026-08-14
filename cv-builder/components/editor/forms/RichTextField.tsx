'use client'

import { useRef } from 'react'
import { Bold, Italic, Underline } from 'lucide-react'

export interface RichTextFieldProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  /** Associates an external <label htmlFor> with the underlying textarea. */
  id?: string
  /** Accessible name for the textarea when no visible/external <label> applies. */
  ariaLabel?: string
  /** Initial/default box height in px, still user-resizable via the drag handle. */
  height?: number
}

const MARKERS = {
  bold: '**',
  italic: '*',
  underline: '__',
} as const

type Format = keyof typeof MARKERS

const BUTTON_ICONS: Record<Format, typeof Bold> = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
}

export function RichTextField({
  value,
  onChange,
  placeholder,
  className,
  id,
  ariaLabel,
  height = 120,
}: RichTextFieldProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function applyFormat(format: Format) {
    const ta = textareaRef.current
    if (!ta) return

    const marker = MARKERS[format]
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)

    let newValue: string
    let newStart: number
    let newEnd: number

    if (start === end) {
      // No selection — insert empty marker pair and position cursor inside
      newValue = value.slice(0, start) + marker + marker + value.slice(end)
      newStart = start + marker.length
      newEnd = newStart
    } else {
      // Check if the selection is already wrapped with this marker (toggle off)
      const markerLen = marker.length
      const beforeMarker = value.slice(start - markerLen, start)
      const afterMarker = value.slice(end, end + markerLen)

      if (beforeMarker === marker && afterMarker === marker) {
        // Toggle off — remove surrounding markers
        newValue =
          value.slice(0, start - markerLen) +
          selected +
          value.slice(end + markerLen)
        newStart = start - markerLen
        newEnd = end - markerLen
      } else if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
        // Selection itself starts and ends with the marker — toggle off
        const inner = selected.slice(markerLen, selected.length - markerLen)
        newValue = value.slice(0, start) + inner + value.slice(end)
        newStart = start
        newEnd = start + inner.length
      } else {
        // Wrap selection
        newValue = value.slice(0, start) + marker + selected + marker + value.slice(end)
        newStart = start + markerLen
        newEnd = end + markerLen
      }
    }

    onChange(newValue)

    // Restore focus and selection after React re-render
    requestAnimationFrame(() => {
      if (!textareaRef.current) return
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(newStart, newEnd)
    })
  }

  const textareaClass =
    'w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-indigo-950 transition-colors duration-150 hover:border-slate-300 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/35 placeholder:text-slate-400'

  return (
    <div className={`relative group ${className ?? ''}`}>
      <div className="absolute -top-3.5 right-2.5 flex gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm opacity-0 pointer-events-none transition-opacity duration-150 group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
        {(['bold', 'italic', 'underline'] as Format[]).map((fmt) => {
          const Icon = BUTTON_ICONS[fmt]
          return (
            <button
              key={fmt}
              type="button"
              onMouseDown={(e) => {
                // Prevent textarea from losing focus/selection on click
                e.preventDefault()
                applyFormat(fmt)
              }}
              aria-label={`Format ${fmt}`}
              className="flex h-5 w-[22px] items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
            >
              <Icon size={12} />
            </button>
          )
        })}
      </div>
      <textarea
        ref={textareaRef}
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={textareaClass}
        style={{ height }}
      />
    </div>
  )
}
