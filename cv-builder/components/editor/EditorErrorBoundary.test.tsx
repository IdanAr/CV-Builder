// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EditorErrorBoundary } from './EditorErrorBoundary'

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test error')
  return <div>child content</div>
}

describe('EditorErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders children normally when no error', () => {
    render(
      <EditorErrorBoundary>
        <ThrowingChild shouldThrow={false} />
      </EditorErrorBoundary>
    )
    expect(screen.getByText('child content')).toBeTruthy()
  })

  it('shows fallback UI when a child throws', () => {
    render(
      <EditorErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </EditorErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeTruthy()
    expect(screen.getByRole('button', { name: /reload editor/i })).toBeTruthy()
  })

  it('"Reload editor" button shows confirmation UI and "Reload" calls window.location.reload', () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { reload: reloadMock },
      writable: true,
    })

    render(
      <EditorErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </EditorErrorBoundary>
    )

    // Click "Reload editor" to enter confirmation state
    fireEvent.click(screen.getByRole('button', { name: /reload editor/i }))

    // Confirmation UI should now be visible
    expect(screen.getByText('Reload the editor?')).toBeTruthy()
    expect(screen.getByRole('button', { name: /^Reload$/i })).toBeTruthy()

    // Click the "Reload" button to actually reload
    fireEvent.click(screen.getByRole('button', { name: /^Reload$/i }))
    expect(reloadMock).toHaveBeenCalledOnce()
  })

  it('Cancel hides the reload confirmation', () => {
    render(
      <EditorErrorBoundary>
        <ThrowingChild shouldThrow={true} />
      </EditorErrorBoundary>
    )

    // Click "Reload editor" to enter confirmation state
    fireEvent.click(screen.getByRole('button', { name: /reload editor/i }))

    // Confirmation UI should now be visible
    expect(screen.getByText('Reload the editor?')).toBeTruthy()

    // Click "Cancel" to go back
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))

    // Should be back to the error fallback UI
    expect(screen.getByText('Something went wrong')).toBeTruthy()
  })
})
