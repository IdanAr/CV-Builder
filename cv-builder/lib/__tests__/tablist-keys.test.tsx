// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { handleTablistKeyDown, tabIndexFor } from '../tablist-keys'

afterEach(cleanup)

/** A minimal stand-in for the four real tablists, same roles and attributes. */
function Tablist({
  labels = ['Edit', 'Design', 'ATS', 'Cover Letter'],
  selected = 'Edit',
  lockedFrom,
  onSelect = () => {},
}: {
  labels?: string[]
  selected?: string
  lockedFrom?: number
  onSelect?: (label: string) => void
}) {
  return (
    <div role="tablist" aria-label="Sections" onKeyDown={handleTablistKeyDown}>
      {labels.map((label, i) => {
        const locked = lockedFrom !== undefined && i >= lockedFrom
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={label === selected}
            aria-disabled={locked || undefined}
            disabled={locked || undefined}
            tabIndex={tabIndexFor(label === selected)}
            onClick={() => onSelect(label)}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

const tab = (name: string) => screen.getByRole('tab', { name })

describe('tabIndexFor', () => {
  // Roving tabindex. Without it, Tab walks through every tab, so reaching the
  // panel you just opened means passing all the ones you did not choose.
  it('makes the tablist a single Tab stop', () => {
    render(<Tablist selected="Design" />)
    expect(tab('Design').tabIndex).toBe(0)
    for (const other of ['Edit', 'ATS', 'Cover Letter']) {
      expect(tab(other).tabIndex).toBe(-1)
    }
  })
})

describe('handleTablistKeyDown', () => {
  it('moves to the next tab on ArrowRight and selects it', () => {
    const onSelect = vi.fn()
    render(<Tablist onSelect={onSelect} />)
    tab('Edit').focus()
    fireEvent.keyDown(tab('Edit'), { key: 'ArrowRight' })

    expect(document.activeElement).toBe(tab('Design'))
    expect(onSelect).toHaveBeenCalledWith('Design')
  })

  it('moves to the previous tab on ArrowLeft', () => {
    render(<Tablist selected="ATS" />)
    tab('ATS').focus()
    fireEvent.keyDown(tab('ATS'), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(tab('Design'))
  })

  // Wrapping is what the pattern specifies, and what makes a four-tab bar
  // navigable without counting.
  it('wraps from the last tab to the first', () => {
    render(<Tablist />)
    tab('Cover Letter').focus()
    fireEvent.keyDown(tab('Cover Letter'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tab('Edit'))
  })

  it('wraps from the first tab to the last', () => {
    render(<Tablist />)
    tab('Edit').focus()
    fireEvent.keyDown(tab('Edit'), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(tab('Cover Letter'))
  })

  it('jumps to the ends on Home and End', () => {
    render(<Tablist />)
    tab('Design').focus()
    fireEvent.keyDown(tab('Design'), { key: 'End' })
    expect(document.activeElement).toBe(tab('Cover Letter'))

    fireEvent.keyDown(tab('Cover Letter'), { key: 'Home' })
    expect(document.activeElement).toBe(tab('Edit'))
  })

  // The wizard and ATS steppers lock steps the user has not reached. Focusing
  // one would strand the user on a control whose click does nothing.
  it('skips locked tabs rather than stranding focus on them', () => {
    render(<Tablist lockedFrom={2} />)
    tab('Design').focus()
    fireEvent.keyDown(tab('Design'), { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tab('Edit'))
    expect(tab('ATS').tabIndex).toBe(-1)
  })

  it('enters from the correct end when focus is on the container', () => {
    const { container } = render(<Tablist />)
    const list = container.querySelector('[role="tablist"]') as HTMLElement
    list.focus()
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(tab('Edit'))
  })

  it('leaves other keys to the browser', () => {
    const onSelect = vi.fn()
    render(<Tablist onSelect={onSelect} />)
    tab('Edit').focus()
    for (const key of ['Tab', 'a', 'ArrowDown', 'ArrowUp']) {
      fireEvent.keyDown(tab('Edit'), { key })
    }
    expect(document.activeElement).toBe(tab('Edit'))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('does nothing when the tablist has no enabled tabs', () => {
    const { container } = render(<Tablist lockedFrom={0} />)
    const list = container.querySelector('[role="tablist"]') as HTMLElement
    expect(() => fireEvent.keyDown(list, { key: 'ArrowRight' })).not.toThrow()
  })
})
