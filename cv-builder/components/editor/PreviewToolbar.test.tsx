// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PreviewToolbar, type PreviewToolbarProps } from './PreviewToolbar'

function setup(overrides: Partial<PreviewToolbarProps> = {}) {
  const props: PreviewToolbarProps = {
    pageText: '2 pages · matches PDF',
    formatScore: 87,
    zoomLabel: 'Fit',
    canZoomIn: true,
    canZoomOut: true,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onFit: vi.fn(),
    fitActive: true,
    zoomMenu: <div data-testid="menu-content">menu</div>,
    ...overrides,
  }
  render(<PreviewToolbar {...props} />)
  return props
}

describe('PreviewToolbar', () => {
  it('renders a labelled toolbar with page text, score chip and zoom label', () => {
    setup()
    expect(screen.getByRole('toolbar', { name: 'Preview controls' })).toBeInTheDocument()
    expect(screen.getAllByText('2 pages · matches PDF').length).toBeGreaterThan(0)
    expect(screen.getByLabelText('ATS format score 87 out of 100')).toHaveTextContent('ATS format 87')
    expect(screen.getByTestId('zoom-percentage')).toHaveTextContent('Fit')
  })

  it('calls zoom handlers', () => {
    const p = setup()
    fireEvent.click(screen.getByTestId('zoom-in'))
    fireEvent.click(screen.getByTestId('zoom-out'))
    fireEvent.click(screen.getByRole('button', { name: /fit width/i }))
    expect(p.onZoomIn).toHaveBeenCalledOnce()
    expect(p.onZoomOut).toHaveBeenCalledOnce()
    expect(p.onFit).toHaveBeenCalledOnce()
  })

  it('disables zoom buttons per canZoomIn / canZoomOut', () => {
    setup({ canZoomIn: false, canZoomOut: false })
    expect(screen.getByTestId('zoom-in')).toBeDisabled()
    expect(screen.getByTestId('zoom-out')).toBeDisabled()
  })

  it('reflects fitActive on the Fit width button', () => {
    setup({ fitActive: false })
    expect(screen.getByRole('button', { name: /fit width/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows the expand toggle only when expandable, with state-aware label', () => {
    const onToggleExpand = vi.fn()
    const { unmount } = (() => {
      const r = render(
        <PreviewToolbar
          pageText="x" formatScore={1} zoomLabel="Fit" canZoomIn canZoomOut onZoomIn={() => {}}
          onZoomOut={() => {}} onFit={() => {}} fitActive zoomMenu={null}
          expandable expanded={false} onToggleExpand={onToggleExpand}
        />
      )
      return r
    })()
    const btn = screen.getByRole('button', { name: 'Expand preview' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(onToggleExpand).toHaveBeenCalledOnce()
    unmount()
    setup()
    expect(screen.queryByRole('button', { name: /expand preview|collapse preview/i })).toBeNull()
  })

  it('mirrors the page text in a polite live region', () => {
    setup({ pageText: 'Calculating pages…' })
    const live = screen.getByText('Calculating pages…', { selector: '[aria-live]' })
    expect(live).toHaveAttribute('aria-live', 'polite')
  })
})
