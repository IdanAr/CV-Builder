// @vitest-environment jsdom
import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Popover } from './Popover'

// These tests drive the popover with userEvent rather than fireEvent. That is
// required, not stylistic: dismissal now listens for `pointerdown` (which is
// what makes it work under touch), and fireEvent.mouseDown dispatches a mouse
// event with no pointer event behind it, so it would not dismiss anything.
describe('Popover', () => {
  it('renders the trigger and, when open, renders children via portal', () => {
    render(
      <Popover trigger={<button>Open</button>} open onOpenChange={vi.fn()}>
        <div>Content</div>
      </Popover>
    )

    expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy()
    expect(screen.getByText('Content')).toBeTruthy()
  })

  it('does not render children when closed', () => {
    render(
      <Popover trigger={<button>Open</button>} open={false} onOpenChange={vi.fn()}>
        <div>Content</div>
      </Popover>
    )

    expect(screen.queryByText('Content')).toBeNull()
  })

  // The panel is portaled to the end of document.body rather than nested in the
  // trigger's subtree, because several triggers sit inside ancestors with
  // backdrop-blur or overflow clipping, which would create a containing block
  // and crop the panel. This is the structural half of that contract; the
  // focus-entry tests below are the half that keeps it reachable.
  it('renders the panel outside the trigger’s DOM subtree', () => {
    render(
      <Popover trigger={<button>Open</button>} open onOpenChange={vi.fn()}>
        <div>Content</div>
      </Popover>
    )

    const trigger = screen.getByRole('button', { name: 'Open' })
    expect(trigger.parentElement?.contains(screen.getByText('Content'))).toBe(false)
  })

  it('asks to close on an outside press and on Escape', async () => {
    const onOpenChange = vi.fn()
    render(
      <>
        <Popover trigger={<button>Open</button>} open onOpenChange={onOpenChange}>
          <div>Content</div>
        </Popover>
        <button>Outside</button>
      </>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Outside' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)

    onOpenChange.mockClear()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('does not close when clicking inside the popover content', async () => {
    const onOpenChange = vi.fn()
    render(
      <Popover trigger={<button>Open</button>} open onOpenChange={onOpenChange}>
        <div>Content</div>
      </Popover>
    )

    await userEvent.click(screen.getByText('Content'))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes when the trigger is pressed again', async () => {
    const onOpenChange = vi.fn()
    render(
      <Popover trigger={<button>Open</button>} open onOpenChange={onOpenChange}>
        <div>Content</div>
      </Popover>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // Consumers write their own ARIA on the trigger — "menu" for ExportMenu and
  // ResumeCard, "listbox" for PreviewTab's zoom picker, "dialog" for
  // AtsScorePanel's help panel. The primitive must not flatten those to the
  // single value it would otherwise supply.
  it('lets the caller’s own aria-haspopup win over the default', () => {
    render(
      <Popover trigger={<button aria-haspopup="listbox">Open</button>} open={false} onOpenChange={vi.fn()}>
        <div>Content</div>
      </Popover>
    )

    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-haspopup', 'listbox')
  })

  describe('focus management', () => {
    // The panel is portaled to the end of document.body, so it is not in the
    // trigger's tab sequence. Without moving focus in on open, a keyboard user
    // can open a popover and Escape out of it but never reach its contents.
    function Harness() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <Popover open={open} onOpenChange={setOpen} trigger={<button>Open</button>}>
            <div role="menu">
              <button onClick={() => setOpen(false)}>Use this</button>
              <button onClick={() => setOpen(false)}>Dismiss</button>
            </div>
          </Popover>
          <button>Outside</button>
        </>
      )
    }

    it('moves focus to the first focusable element in the panel when opened', async () => {
      render(<Harness />)

      await userEvent.click(screen.getByRole('button', { name: 'Open' }))

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use this' }))
    })

    it('returns focus to the trigger when an action inside the panel closes it', async () => {
      render(<Harness />)

      await userEvent.click(screen.getByRole('button', { name: 'Open' }))
      await userEvent.click(screen.getByRole('button', { name: 'Use this' }))

      expect(screen.queryByRole('menu')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }))
    })

    it('returns focus to the trigger when Escape closes it', async () => {
      render(<Harness />)

      await userEvent.click(screen.getByRole('button', { name: 'Open' }))
      await userEvent.keyboard('{Escape}')

      expect(screen.queryByRole('menu')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }))
    })

    it('leaves focus alone when an outside click closes it', async () => {
      render(<Harness />)

      await userEvent.click(screen.getByRole('button', { name: 'Open' }))
      await userEvent.click(screen.getByRole('button', { name: 'Outside' }))

      expect(screen.queryByRole('menu')).toBeNull()
      // Focus belongs to whatever the user clicked, not yanked back to the trigger.
      expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Open' }))
    })

    it('does not steal focus when the panel has nothing focusable', async () => {
      function TextOnly() {
        const [open, setOpen] = useState(false)
        return (
          <Popover open={open} onOpenChange={setOpen} trigger={<button>Open</button>}>
            <div>Just text</div>
          </Popover>
        )
      }
      render(<TextOnly />)

      const trigger = screen.getByRole('button', { name: 'Open' })
      await userEvent.click(trigger)

      expect(screen.getByText('Just text')).toBeTruthy()
      expect(document.activeElement).toBe(trigger)
    })

    it('re-enters focus on a second open after being closed', async () => {
      render(<Harness />)

      await userEvent.click(screen.getByRole('button', { name: 'Open' }))
      await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
      await userEvent.click(screen.getByRole('button', { name: 'Open' }))

      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Use this' }))
    })
  })

  // The three auto-flip tests that used to sit here asserted the exact inline
  // `top` the old implementation computed — 388px below, 142px flipped above —
  // by mocking getBoundingClientRect per className. They went with the
  // algorithm they were testing. Positioning is now Radix's collision
  // detection, which corrects on both axes rather than only flipping
  // vertically, and jsdom reports a zero rect for everything, so there is no
  // honest way to assert it here. It was checked in a real browser at 375px
  // instead; see the responsive pass that follows.
})
