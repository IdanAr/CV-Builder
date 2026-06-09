'use client'

import { useRef } from 'react'

export interface RichTextFieldProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

const MARKERS = {
  bold: '**',
  italic: '*',
  underline: '__',
} as const

type Format = keyof typeof MARKERS

const BUTTON_LABELS: Record<Format, string> = {
  bold: 'B',
  italic: 'I',
  underline: 'U',
}

const BUTTON_STYLES: Record<Format, string> = {
  bold: 'font-bold',
  italic: 'italic',
  underline: 'underline',
}

export function RichTextField({
  value,
  onChange,
  placeholder,
  rows = 5,
  className,
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
    'w-full border border-indigo-200 rounded-lg px-3 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y'

  return (
    <div className={className}>
      <div className="flex gap-1 mb-1">
        {(['bold', 'italic', 'underline'] as Format[]).map((fmt) => (
          <button
            key={fmt}
            type="button"
            onMouseDown={(e) => {
              // Prevent textarea from losing focus/selection on click
              e.preventDefault()
              applyFormat(fmt)
            }}
            aria-label={`Format ${fmt}`}
            className={`px-2 py-0.5 text-xs border border-indigo-200 rounded text-indigo-700 bg-white/70 hover:bg-indigo-50 hover:border-indigo-400 transition-colors ${BUTTON_STYLES[fmt]}`}
          >
            {BUTTON_LABELS[fmt]}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={textareaClass}
      />
    </div>
  )
}
