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

  it('gives the sheet and card the sizing classes the mobile layout depends on', () => {
    setup()
    const dialog = screen.getByRole('dialog')
    expect(dialog.className).toContain('max-sm:h-dvh')
    expect(dialog.className).toContain('sm:max-w-[35rem]')
    expect(dialog.className).toContain('rounded-overlay')
  })
})
