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
})
