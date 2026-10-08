// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from './Dialog'

function setup(props: Partial<React.ComponentProps<typeof Dialog>> = {}) {
  const onOpenChange = vi.fn()
  render(
    <Dialog open onOpenChange={onOpenChange} title="New profile" description="Pick a role" footer={<button>Save</button>} {...props}>
      <input aria-label="Name" />
    </Dialog>
  )
  return { onOpenChange }
}

describe('Dialog', () => {
  it('renders an accessible dialog with title, description, body and footer', () => {
    setup()
    const dialog = screen.getByRole('dialog', { name: 'New profile' })
    expect(dialog).toHaveAccessibleDescription('Pick a role')
    expect(screen.getByLabelText('Name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  })

  it('asks to close on Escape', async () => {
    const { onOpenChange } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('asks to close from the close button', async () => {
    const { onOpenChange } = setup()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('asks to close on an outside press', async () => {
    const { onOpenChange } = setup()
    // Radix dismisses on pointerdown outside the content.
    const overlay = document.querySelector('.bg-fg-heading\\/40')
    expect(overlay).not.toBeNull()
    await userEvent.click(overlay as Element)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('lets the caller choose where focus lands on open', async () => {
    render(
      <Dialog
        open
        onOpenChange={() => {}}
        title="T"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          document.getElementById('second')?.focus()
        }}
      >
        <input id="first" aria-label="First" />
        <input id="second" aria-label="Second" />
      </Dialog>
    )
    await waitFor(() => expect(screen.getByLabelText('Second')).toHaveFocus())
  })

  it('breaks long unbroken titles instead of overflowing', () => {
    setup({ title: 'x'.repeat(100) })
    expect(screen.getByRole('heading').className).toContain('break-words')
  })

  it('does not render when closed', () => {
    setup({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('returns focus to the element passed in on close', async () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    const { rerender } = render(
      <Dialog open onOpenChange={() => {}} title="T" returnFocusTo={opener}>
        <input aria-label="Name" />
      </Dialog>
    )
    rerender(
      <Dialog open={false} onOpenChange={() => {}} title="T" returnFocusTo={opener}>
        <input aria-label="Name" />
      </Dialog>
    )
    await waitFor(() => expect(document.activeElement).toBe(opener))
    opener.remove()
  })

  it('falls back to fallbackReturnFocusTo when returnFocusTo has left the DOM', async () => {
    const gone = document.createElement('button')
    const fallback = document.createElement('button')
    document.body.appendChild(fallback)
    const ui = (open: boolean) => (
      <Dialog open={open} onOpenChange={() => {}} title="T" returnFocusTo={gone} fallbackReturnFocusTo={fallback}>
        <input aria-label="Name" />
      </Dialog>
    )
    const { rerender } = render(ui(true))
    rerender(ui(false))
    await waitFor(() => expect(document.activeElement).toBe(fallback))
    fallback.remove()
  })

  it('does not throw when neither return target is connected', async () => {
    const a = document.createElement('button')
    const b = document.createElement('button')
    const ui = (open: boolean) => (
      <Dialog open={open} onOpenChange={() => {}} title="T" returnFocusTo={a} fallbackReturnFocusTo={b}>
        <input aria-label="Name" />
      </Dialog>
    )
    const { rerender } = render(ui(true))
    rerender(ui(false))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('gives the sheet and card the sizing classes the mobile layout depends on', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('max-sm:h-dvh')
    expect(dialog.className).toContain('sm:max-w-[35rem]')
    expect(dialog.className).toContain('rounded-overlay')
  })
})
