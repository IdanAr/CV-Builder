// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { MonthYearPicker } from './MonthYearPicker'

afterEach(cleanup)

function widthClasses(el: Element): string[] {
  return el.className.split(/\s+/).filter((c) => /^w-/.test(c))
}

describe('MonthYearPicker layout', () => {
  // The regression this guards: the shared inputClass carries `w-full`, and
  // the fields were composed with a template string rather than cn(). Both
  // widths then reached the DOM, and because Tailwind emits `.w-full` and
  // `.w-auto` *after* `.w-20`/`.w-16`, the wider utility won on source order.
  // The month and year fields stretched to fill their grid column and pushed
  // the "Present" toggle out of the row, overlapping it.
  //
  // Asserting "exactly one width class" is the precise check: a second one
  // surviving is the bug, regardless of which happens to win today.
  it('gives the month field exactly one width, the intended one', () => {
    render(<MonthYearPicker value="2022-07" onChange={vi.fn()} placeholder="Start date" />)
    expect(widthClasses(screen.getByLabelText('Start date month'))).toEqual(['w-20'])
  })

  it('gives the year field exactly one width, the intended one', () => {
    render(<MonthYearPicker value="2022-07" onChange={vi.fn()} placeholder="Start date" />)
    expect(widthClasses(screen.getByLabelText('Start date year'))).toEqual(['w-16'])
  })

  it('never lets the shared full-width rule reach a date field', () => {
    render(<MonthYearPicker value="2022-07" onChange={vi.fn()} allowPresent placeholder="End date" />)
    for (const label of ['End date month', 'End date year']) {
      const classes = screen.getByLabelText(label).className.split(/\s+/)
      expect(classes).not.toContain('w-full')
      expect(classes).not.toContain('w-auto')
    }
  })

  // The other half of the report: even at the correct widths, the end-date
  // row needs more horizontal space than the two-column grid gives it in a
  // narrow editor panel. The toggle carries `whitespace-nowrap`, so if the
  // row cannot wrap the toggle spills out of the card instead of moving down.
  it('lets the row wrap so the Present toggle never overlaps the fields', () => {
    const { container } = render(
      <MonthYearPicker value="2022-07" onChange={vi.fn()} allowPresent placeholder="End date" />
    )
    const classes = (container.firstChild as HTMLElement).className.split(/\s+/)
    expect(classes).toContain('flex-wrap')
    // Without min-w-0 the grid track's default `min-width: auto` refuses to
    // shrink below the content width, so wrapping alone would not help.
    expect(classes).toContain('min-w-0')
  })
})

describe('MonthYearPicker behaviour', () => {
  // Guards that the layout fix did not disturb the value contract, which is
  // what every consuming form depends on.
  it('emits YYYY-MM once both parts are set', () => {
    const onChange = vi.fn()
    render(<MonthYearPicker value="2022" onChange={onChange} placeholder="Start date" />)
    fireEvent.change(screen.getByLabelText('Start date month'), { target: { value: '07' } })
    expect(onChange).toHaveBeenCalledWith('2022-07')
  })

  it('emits the bare year when no month is chosen', () => {
    const onChange = vi.fn()
    render(<MonthYearPicker value="" onChange={onChange} placeholder="Start date" />)
    fireEvent.change(screen.getByLabelText('Start date year'), { target: { value: '2021' } })
    expect(onChange).toHaveBeenCalledWith('2021')
  })

  it('emits Present when the toggle is checked, and hides the date fields', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <MonthYearPicker value="2022-07" onChange={onChange} allowPresent placeholder="End date" />
    )
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith('Present')

    rerender(
      <MonthYearPicker value="Present" onChange={onChange} allowPresent placeholder="End date" />
    )
    expect(screen.queryByLabelText('End date month')).toBeNull()
    expect(screen.queryByLabelText('End date year')).toBeNull()
    expect(screen.getByRole('checkbox')).toBeTruthy()
  })

  it('offers no Present toggle on a start date', () => {
    render(<MonthYearPicker value="2022-07" onChange={vi.fn()} placeholder="Start date" />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})
