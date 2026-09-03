'use client'

import { useId } from 'react'
import { MonthYearPicker } from './MonthYearPicker'
import { labelClass } from './field-styles'

export interface DateRangeFieldsProps {
  startValue: string
  endValue: string
  onStartChange: (value: string) => void
  onEndChange: (value: string) => void
}

/**
 * The start/end date pair used by every dated entry (work roles, education,
 * volunteer, projects, custom sections). Replaces a `grid grid-cols-2 gap-2`
 * holding two bare MonthYearPickers, which had two problems.
 *
 * The fields were unlabelled to sighted users. Each picker carried only
 * `sr-only` labels, so the visible interface was four boxes reading
 * "Mar / 2021 / Jul / 2022" with nothing saying which pair was the start and
 * which the end. They are now named, and named once here rather than at each
 * of the six call sites.
 *
 * The row also went ragged at the widths this editor actually renders at.
 * Measured in a browser: the end picker needs 216px for its month select (80),
 * year input (64), "Present" toggle (60) and two 6px gaps. An even two-column
 * grid only gives it that at a container width of ~440px or more, and the edit
 * pane is narrower — so between roughly 340px and 420px the "Present" checkbox
 * dropped onto a second line, leaving the right column 52px tall against the
 * left column's 30px. That is the misalignment: not a bug in the picker, but a
 * column too narrow for the content that had to sit in it.
 *
 * A `sm:` breakpoint cannot fix it, because the constraint is the width of the
 * *container* — a resizable editor pane on a wide desktop — and Tailwind's
 * breakpoints respond to the viewport. So this wraps on intrinsic size
 * instead: `flex-wrap` with a floor under each group (152px for the start
 * pair, 224px for the end pair including "Present"). Above ~388px both sit
 * side by side with "Present" inline; below it the whole End Date group —
 * label, both fields and the checkbox together — moves to its own full-width
 * row and stays intact. "Present" is therefore inline at every width, which it
 * previously was not.
 */
export function DateRangeFields({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
}: DateRangeFieldsProps) {
  const baseId = useId()
  const startLabelId = `${baseId}-start`
  const endLabelId = `${baseId}-end`

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2">
      {/* role="group" rather than <label>: each side names two or three
          controls (month, year, and for the end date the Present toggle), and
          a <label> may only name one. The pickers keep their own sr-only
          per-field labels underneath this. */}
      <div role="group" aria-labelledby={startLabelId} className="min-w-[9.5rem] flex-1">
        <span id={startLabelId} className={labelClass}>Start Date</span>
        <MonthYearPicker value={startValue} onChange={onStartChange} placeholder="Start date" />
      </div>

      <div role="group" aria-labelledby={endLabelId} className="min-w-[14rem] flex-1">
        <span id={endLabelId} className={labelClass}>End Date</span>
        <MonthYearPicker value={endValue} onChange={onEndChange} allowPresent placeholder="End date" />
      </div>
    </div>
  )
}
