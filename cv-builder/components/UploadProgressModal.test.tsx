// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import UploadProgressModal from './UploadProgressModal'

describe('UploadProgressModal', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when closed', () => {
    render(
      <UploadProgressModal
        open={false}
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not start the fake-progress animation while closed', () => {
    const { rerender } = render(
      <UploadProgressModal
        open={false}
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    act(() => { vi.advanceTimersByTime(5000) })
    rerender(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('shows the filename and "Reading…" immediately at 0%, in a dialog', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('cv.pdf')).toBeInTheDocument()
    expect(screen.getByText('Reading cv.pdf…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
  })

  it('swaps to "Parsing document…" 900ms into the reading phase', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    act(() => { vi.advanceTimersByTime(900) })
    expect(screen.getByText('Parsing document…')).toBeInTheDocument()
  })

  it('animates percent upward but never reaches the 45% cap while stage is "reading"', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    act(() => { vi.advanceTimersByTime(5000) })
    const value = Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThan(0)
    expect(value).toBeLessThan(45)
  })

  it('snaps to 45% immediately when stage changes from "reading" to "extracting"', () => {
    const { rerender } = render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    vi.advanceTimersByTime(300)
    rerender(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="extracting"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45')
    expect(screen.getByText('Extracting information…')).toBeInTheDocument()
  })

  it('swaps to "Finalizing…" 1500ms into the extracting phase', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="extracting"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByText('Finalizing…')).toBeInTheDocument()
  })

  it('shows 100% and "Done — opening your CV…" when stage is "done"', () => {
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="done"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByText('Done — opening your CV…')).toBeInTheDocument()
  })

  it('does not call onClose when the backdrop is clicked while reading', () => {
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={onClose}
      />
    )
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows the error message and wires up Try another file / Close on error', () => {
    const onRetry = vi.fn()
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="error"
        errorMessage="Could not read the file."
        onRetry={onRetry}
        onClose={onClose}
      />
    )
    expect(screen.getByText('Could not read the file.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /try another file/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('portals the dialog to document.body, so ancestor CSS (e.g. backdrop-filter) cannot break its fixed positioning', () => {
    const { container } = render(
      <div data-testid="ancestor-with-filter">
        <UploadProgressModal
          open
          filename="cv.pdf"
          stage="reading"
          onRetry={() => {}}
          onClose={() => {}}
        />
      </div>
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog.parentElement).toBe(document.body)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('calls onClose when the backdrop is clicked in the error state', () => {
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="error"
        errorMessage="Could not read the file."
        onRetry={() => {}}
        onClose={onClose}
      />
    )
    fireEvent.mouseDown(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the Close button in the error state, and calls onClose on Escape', () => {
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="error"
        errorMessage="Could not read the file."
        onRetry={() => {}}
        onClose={onClose}
      />
    )
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores Escape while the upload is in progress (not dismissible)', () => {
    const onClose = vi.fn()
    render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="reading"
        onRetry={() => {}}
        onClose={onClose}
      />
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('restores focus to whatever was focused before the dialog opened, once it closes', () => {
    const trigger = document.createElement('button')
    trigger.textContent = 'Upload CV'
    document.body.appendChild(trigger)
    trigger.focus()
    expect(trigger).toHaveFocus()

    const { rerender } = render(
      <UploadProgressModal
        open
        filename="cv.pdf"
        stage="error"
        errorMessage="Could not read the file."
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(screen.getByRole('button', { name: /close/i })).toHaveFocus()

    rerender(
      <UploadProgressModal
        open={false}
        filename=""
        stage="reading"
        onRetry={() => {}}
        onClose={() => {}}
      />
    )
    expect(trigger).toHaveFocus()
    trigger.remove()
  })
})
