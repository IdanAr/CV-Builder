// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AiSuggestButton } from './AiSuggestButton'

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AiSuggestButton', () => {
  it('renders the Sparkles icon rather than a raw emoji', () => {
    render(
      <AiSuggestButton
        resumeId="r1"
        currentValue="Some notes"
        context={{ field: 'summary' }}
        onAccept={() => {}}
      />
    )
    expect(screen.getByTestId('ai-suggest-icon')).toBeInTheDocument()
    expect(screen.queryByText('✨')).not.toBeInTheDocument()
  })

  it('gives the button a title/aria-label that clearly conveys AI involvement', () => {
    render(
      <AiSuggestButton
        resumeId="r1"
        currentValue="Some notes"
        context={{ field: 'summary' }}
        onAccept={() => {}}
      />
    )
    const button = screen.getByRole('button')
    expect(button.getAttribute('title')).toMatch(/AI/i)
    expect(button.getAttribute('aria-label')).toMatch(/AI/i)
  })

  it('swaps to a spinning loading icon while a suggestion is being generated, keeping the AI-labeled affordance', async () => {
    let resolveFetch: (v: unknown) => void = () => {}
    const fetchMock = vi.fn().mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AiSuggestButton
        resumeId="r1"
        currentValue="Some notes"
        context={{ field: 'summary' }}
        onAccept={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(screen.getByTestId('ai-suggest-loading-icon')).toBeInTheDocument())
    expect(screen.queryByTestId('ai-suggest-icon')).not.toBeInTheDocument()
    expect(screen.getByRole('button').getAttribute('aria-label')).toMatch(/AI/i)

    resolveFetch(jsonResponse({ suggestion: 'A suggestion', pendingApprovals: [] }))
    await waitFor(() => expect(screen.getByTestId('ai-suggest-icon')).toBeInTheDocument())
  })

  it('clamps the suggestion popover width to the viewport instead of a fixed w-80', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ suggestion: 'A suggestion', pendingApprovals: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AiSuggestButton
        resumeId="r1"
        currentValue="Some notes"
        context={{ field: 'summary' }}
        onAccept={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button'))

    const panel = await screen.findByText('Use this').then((btn) => btn.closest('[role="status"]') as HTMLElement)

    // Must not rely on a bare fixed width (w-80 = 320px) with no upper bound
    // relative to the viewport — that clips in narrow sidebar columns.
    expect(panel.className).not.toMatch(/(^|\s)w-80(\s|$)/)
    // Width must be clamped against the viewport so it can never exceed it.
    expect(panel.className).toMatch(/w-\[min\(20rem,calc\(100vw-2rem\)\)\]/)
  })

  it('caps the suggestion panel height and makes it internally scrollable', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ suggestion: 'A '.repeat(500), pendingApprovals: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <AiSuggestButton
        resumeId="r1"
        currentValue="Some notes"
        context={{ field: 'summary' }}
        onAccept={() => {}}
      />
    )
    fireEvent.click(screen.getByRole('button'))

    const panel = await screen.findByText('Use this').then((btn) => btn.closest('[role="status"]') as HTMLElement)

    // A long suggestion must never be cut off with no way to read the rest.
    expect(panel.className).toMatch(/max-h-\[60vh\]/)
    expect(panel.className).toMatch(/overflow-y-auto/)
  })

  it('renders the suggestion panel via a fixed-position portal so it cannot be clipped by a scrollable ancestor', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ suggestion: 'A suggestion', pendingApprovals: [] })
    )
    vi.stubGlobal('fetch', fetchMock)

    render(
      <div style={{ overflow: 'hidden', height: '10px' }}>
        <AiSuggestButton
          resumeId="r1"
          currentValue="Some notes"
          context={{ field: 'summary' }}
          onAccept={() => {}}
        />
      </div>
    )
    fireEvent.click(screen.getByRole('button'))

    const panel = await screen.findByText('Use this').then((btn) => btn.closest('[role="status"]') as HTMLElement)
    // Portaled straight onto document.body, outside the clipping ancestor.
    expect(panel.closest('div[style*="overflow: hidden"]')).toBeNull()
    expect(panel.closest('body')).toBe(document.body)
  })
})
