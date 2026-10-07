// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { usePipelineShortcuts, type PipelineShortcutHandlers } from './use-pipeline-shortcuts'

let handlers: PipelineShortcutHandlers

function Harness({ enabled }: { enabled?: boolean }) {
  usePipelineShortcuts(handlers, enabled)
  return (
    <div>
      <input aria-label="field" />
      <textarea aria-label="area" />
      <button>btn</button>
      <div role="menu"><div role="menuitem" tabIndex={0}>item</div></div>
      <div role="dialog"><span>in dialog</span></div>
      <div role="listbox"><span>in listbox</span></div>
    </div>
  )
}

function total() {
  return Object.values(handlers).reduce((n, fn) => n + (fn as ReturnType<typeof vi.fn>).mock.calls.length, 0)
}

beforeEach(() => {
  handlers = { move: vi.fn(), openSelected: vi.fn(), runPrimary: vi.fn(), dismissSelected: vi.fn() }
})

describe('usePipelineShortcuts', () => {
  it('maps keys to handlers', () => {
    render(<Harness />)
    fireEvent.keyDown(document.body, { key: 'j' })
    fireEvent.keyDown(document.body, { key: 'K' })
    fireEvent.keyDown(document.body, { key: 'Enter' })
    fireEvent.keyDown(document.body, { key: 'a' })
    fireEvent.keyDown(document.body, { key: 'D' })
    expect(handlers.move).toHaveBeenNthCalledWith(1, 1)
    expect(handlers.move).toHaveBeenNthCalledWith(2, -1)
    expect(handlers.openSelected).toHaveBeenCalledTimes(1)
    expect(handlers.runPrimary).toHaveBeenCalledTimes(1)
    expect(handlers.dismissSelected).toHaveBeenCalledTimes(1)
  })

  it('ignores typing targets', () => {
    const { getByLabelText } = render(<Harness />)
    fireEvent.keyDown(getByLabelText('field'), { key: 'j' })
    fireEvent.keyDown(getByLabelText('area'), { key: 'd' })
    expect(total()).toBe(0)
  })

  it('ignores modifier keys', () => {
    render(<Harness />)
    fireEvent.keyDown(document.body, { key: 'j', metaKey: true })
    fireEvent.keyDown(document.body, { key: 'a', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'd', altKey: true })
    expect(total()).toBe(0)
  })

  it('does not hijack Enter on a focused button', () => {
    const { getByText } = render(<Harness />)
    fireEvent.keyDown(getByText('btn'), { key: 'Enter' })
    expect(handlers.openSelected).not.toHaveBeenCalled()
  })

  it('ignores already-handled events', () => {
    render(<Harness />)
    const e = new KeyboardEvent('keydown', { key: 'j', bubbles: true, cancelable: true })
    document.addEventListener('keydown', (ev) => ev.preventDefault(), { once: true, capture: true })
    document.body.dispatchEvent(e)
    expect(total()).toBe(0)
  })

  it('ignores keys from inside an open menu, dialog or listbox', () => {
    const { getByText } = render(<Harness />)
    fireEvent.keyDown(getByText('item'), { key: 'd' })
    fireEvent.keyDown(getByText('in dialog'), { key: 'a' })
    fireEvent.keyDown(getByText('in listbox'), { key: 'j' })
    expect(total()).toBe(0)
  })

  it('does not repeat a / d while a key is held, but J / K still repeat', () => {
    render(<Harness />)
    fireEvent.keyDown(document.body, { key: 'a', repeat: true })
    fireEvent.keyDown(document.body, { key: 'D', repeat: true })
    expect(handlers.runPrimary).not.toHaveBeenCalled()
    expect(handlers.dismissSelected).not.toHaveBeenCalled()
    fireEvent.keyDown(document.body, { key: 'j', repeat: true })
    fireEvent.keyDown(document.body, { key: 'k', repeat: true })
    expect(handlers.move).toHaveBeenCalledTimes(2)
  })

  it('ignores keys while an IME composition is in progress', () => {
    render(<Harness />)
    fireEvent.keyDown(document.body, { key: 'j', isComposing: true })
    fireEvent.keyDown(document.body, { key: 'a', isComposing: true })
    expect(total()).toBe(0)
  })

  it('does nothing when disabled', () => {
    render(<Harness enabled={false} />)
    fireEvent.keyDown(document.body, { key: 'j' })
    expect(total()).toBe(0)
  })

  it('removes the listener on unmount', () => {
    const { unmount } = render(<Harness />)
    unmount()
    fireEvent.keyDown(document.body, { key: 'j' })
    expect(total()).toBe(0)
  })
})
