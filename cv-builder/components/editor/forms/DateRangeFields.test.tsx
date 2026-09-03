// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DateRangeFields } from './DateRangeFields'

const ROOT = join(__dirname, '..', '..', '..')

function renderRange(over: Partial<React.ComponentProps<typeof DateRangeFields>> = {}) {
  const onStartChange = vi.fn()
  const onEndChange = vi.fn()
  render(
    <DateRangeFields
      startValue="2021-03"
      endValue="2022-07"
      onStartChange={onStartChange}
      onEndChange={onEndChange}
      {...over}
    />
  )
  return { onStartChange, onEndChange }
}

describe('DateRangeFields', () => {
  // The visible interface used to be four unlabelled boxes reading
  // "Mar / 2021 / Jul / 2022" — every label was sr-only, so a sighted user had
  // nothing saying which pair was the start and which the end.
  it('names both pairs visibly, not only to screen readers', () => {
    renderRange()
    const start = screen.getByText('Start Date')
    const end = screen.getByText('End Date')
    expect(start).toBeInTheDocument()
    expect(end).toBeInTheDocument()
    expect(start.className).not.toMatch(/sr-only/)
    expect(end.className).not.toMatch(/sr-only/)
  })

  // role="group" rather than <label>, because each side names two or three
  // controls and a <label> may only name one.
  it('exposes each pair as a group carrying that name', () => {
    renderRange()
    expect(screen.getByRole('group', { name: 'Start Date' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'End Date' })).toBeInTheDocument()
  })

  it('routes each pair’s edits to its own callback', async () => {
    const { onStartChange, onEndChange } = renderRange()

    await userEvent.selectOptions(
      screen.getByRole('group', { name: 'Start Date' }).querySelector('select')!,
      '05'
    )
    expect(onStartChange).toHaveBeenCalledWith('2021-05')
    expect(onEndChange).not.toHaveBeenCalled()

    await userEvent.selectOptions(
      screen.getByRole('group', { name: 'End Date' }).querySelector('select')!,
      '09'
    )
    expect(onEndChange).toHaveBeenCalledWith('2022-09')
  })

  it('offers Present on the end date only, and emits it', async () => {
    const { onEndChange } = renderRange()

    const startGroup = screen.getByRole('group', { name: 'Start Date' })
    expect(startGroup.textContent).not.toMatch(/Present/)

    await userEvent.click(screen.getByRole('checkbox', { name: /present/i }))
    expect(onEndChange).toHaveBeenCalledWith('Present')
  })

  /**
   * The alignment contract, and the reason for the two floors. Measured in a
   * real browser: the end pair needs 216px — an 80px month select, a 64px year
   * input, a 60px "Present" toggle and two 6px gaps. Under an even two-column
   * grid it only got that at a container width of ~440px or more, and the edit
   * pane is narrower, so between roughly 340px and 420px "Present" dropped to a
   * second line and left the right column 52px tall against the left's 30px.
   *
   * These are class assertions rather than geometry because jsdom has no
   * layout engine and reports a zero rect for everything. The behaviour they
   * stand for was verified by measurement at ten container widths from 640px
   * down to 260px, where "Present" now sits inline at every one.
   */
  it('gives the end pair a floor wide enough to keep Present on one line', () => {
    renderRange()
    const end = screen.getByRole('group', { name: 'End Date' })
    // 14rem = 224px, clear of the 216px the content measures.
    expect(end.className).toMatch(/min-w-\[14rem\]/)
    expect(end.className).toMatch(/flex-1/)
  })

  it('wraps on its own width rather than on a viewport breakpoint', () => {
    const { container } = render(
      <DateRangeFields startValue="" endValue="" onStartChange={vi.fn()} onEndChange={vi.fn()} />
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toMatch(/flex-wrap/)
    // A `sm:`/`md:` prefix would key the layout to the viewport, which cannot
    // see how wide the editor pane actually is.
    expect(row.className).not.toMatch(/\b(sm|md|lg|xl):/)
  })
})

describe('forms use the shared date range', () => {
  const FORMS_WITH_DATE_RANGES = [
    'components/editor/forms/WorkForm.tsx',
    'components/editor/forms/EducationForm.tsx',
    'components/editor/forms/VolunteerForm.tsx',
    'components/editor/forms/ProjectsForm.tsx',
    'components/editor/forms/CustomSectionForm.tsx',
  ]

  // Six copies of `grid grid-cols-2` + two bare pickers is how the labels went
  // missing and the row went ragged in the first place. One component owns it.
  it.each(FORMS_WITH_DATE_RANGES)('%s renders no bare start/end picker pair', (file) => {
    const source = readFileSync(join(ROOT, file), 'utf8')
    expect(source).toContain('DateRangeFields')
    expect(source, `${file} still lays a start/end pair out by hand`).not.toMatch(
      /MonthYearPicker[^\n]*startDate/
    )
  })
})
