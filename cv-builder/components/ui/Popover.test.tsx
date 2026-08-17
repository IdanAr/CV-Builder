// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Popover } from './Popover'

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

  it('closes on outside click and Escape, returning focus to the trigger', async () => {
    const onOpenChange = vi.fn()
    render(
      <Popover trigger={<button>Open</button>} open onOpenChange={onOpenChange}>
        <div>Content</div>
      </Popover>
    )

    fireEvent.mouseDown(document.body)
    expect(onOpenChange).toHaveBeenCalledWith(false)

    onOpenChange.mockClear()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open' }))
  })

  it('does not close when clicking inside the trigger or the popover content', () => {
    const onOpenChange = vi.fn()
    render(
      <Popover trigger={<button>Open</button>} open onOpenChange={onOpenChange}>
        <div>Content</div>
      </Popover>
    )

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Open' }))
    fireEvent.mouseDown(screen.getByText('Content'))
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  describe('auto-flip placement', () => {
    // jsdom returns an all-zero rect for every element by default. Popover
    // calls getBoundingClientRect() on two different divs — its trigger
    // wrapper (`relative inline-block`) and the portaled panel wrapper
    // (`fixed z-[100]`) — so this mock distinguishes them by className to
    // simulate a trigger sitting near the bottom of a short viewport and a
    // panel too tall to fit below it, matching the pattern used for
    // DesignPanel's drag-and-drop rect mocking.
    function mockRects({ triggerTop, triggerBottom, panelHeight }: { triggerTop: number; triggerBottom: number; panelHeight: number }) {
      return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: HTMLElement
      ) {
        if (this.className.includes('inline-block')) {
          return {
            top: triggerTop, bottom: triggerBottom, left: 0, right: 100, width: 100,
            height: triggerBottom - triggerTop, x: 0, y: triggerTop, toJSON: () => ({}),
          } as DOMRect
        }
        if (this.className.includes('fixed')) {
          return {
            top: 0, bottom: panelHeight, left: 0, right: 100, width: 100,
            height: panelHeight, x: 0, y: 0, toJSON: () => ({}),
          } as DOMRect
        }
        return { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
      })
    }

    it('opens below the trigger (default) when there is enough room', () => {
      vi.stubGlobal('innerHeight', 800)
      const rectSpy = mockRects({ triggerTop: 350, triggerBottom: 380, panelHeight: 200 })

      render(
        <Popover trigger={<button>Open</button>} open onOpenChange={vi.fn()}>
          <div>Content</div>
        </Popover>
      )

      const panel = screen.getByText('Content').parentElement as HTMLElement
      expect(panel.style.top).toBe('388px') // triggerBottom(380) + 8

      rectSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('flips above the trigger when the panel does not fit below but does fit above', () => {
      vi.stubGlobal('innerHeight', 400)
      const rectSpy = mockRects({ triggerTop: 350, triggerBottom: 380, panelHeight: 200 })

      render(
        <Popover trigger={<button>Open</button>} open onOpenChange={vi.fn()}>
          <div>Content</div>
        </Popover>
      )

      // below would be 380 + 8 + 200 = 588 > innerHeight(400) → doesn't fit
      // above: triggerTop(350) - panelHeight(200) - 8 = 142, and
      // triggerTop(350) > panelHeight(200) + 8 → fits
      const panel = screen.getByText('Content').parentElement as HTMLElement
      expect(panel.style.top).toBe('142px')

      rectSpy.mockRestore()
      vi.unstubAllGlobals()
    })

    it('falls back to the below position when neither side fits', () => {
      vi.stubGlobal('innerHeight', 150)
      // Trigger low in a very short viewport, panel taller than the room
      // available on either side.
      const rectSpy = mockRects({ triggerTop: 60, triggerBottom: 90, panelHeight: 200 })

      render(
        <Popover trigger={<button>Open</button>} open onOpenChange={vi.fn()}>
          <div>Content</div>
        </Popover>
      )

      const panel = screen.getByText('Content').parentElement as HTMLElement
      expect(panel.style.top).toBe('98px') // triggerBottom(90) + 8 — unchanged fallback

      rectSpy.mockRestore()
      vi.unstubAllGlobals()
    })
  })
})
