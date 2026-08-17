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

  describe('outside-click handling for a pending suggestion', () => {
    it('does not discard a pending suggestion on an outside click; only "Use this" or "Dismiss" do', async () => {
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
      await screen.findByText('Use this')

      // A stray outside click — e.g. the user clicking back into a nearby
      // textarea to compare the suggestion against their original text —
      // must not silently discard the generated (rate-limited, paid)
      // suggestion. Popover detects outside clicks on `mousedown`.
      fireEvent.mouseDown(document.body)
      fireEvent.click(document.body)

      expect(screen.getByText('A suggestion')).toBeInTheDocument()
      expect(screen.getByText('Use this')).toBeInTheDocument()

      // The explicit Dismiss action must still close it.
      fireEvent.click(screen.getByText('Dismiss'))
      expect(screen.queryByText('A suggestion')).not.toBeInTheDocument()
    })

    it('still clears the pending suggestion when "Use this" is clicked, and calls onAccept', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({ suggestion: 'A suggestion', pendingApprovals: [] })
      )
      vi.stubGlobal('fetch', fetchMock)
      const onAccept = vi.fn()

      render(
        <AiSuggestButton
          resumeId="r1"
          currentValue="Some notes"
          context={{ field: 'summary' }}
          onAccept={onAccept}
        />
      )
      fireEvent.click(screen.getByRole('button'))
      await screen.findByText('Use this')

      fireEvent.click(screen.getByText('Use this'))

      expect(onAccept).toHaveBeenCalledWith('A suggestion')
      expect(screen.queryByText('A suggestion')).not.toBeInTheDocument()
    })

    it('still clears a pending suggestion on Escape (a deliberate, explicit dismiss gesture)', async () => {
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
      await screen.findByText('Use this')

      fireEvent.keyDown(document, { key: 'Escape' })

      expect(screen.queryByText('A suggestion')).not.toBeInTheDocument()
    })

    it('still clears an error on an outside click (errors remain dismissible that way)', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Rate limited' }),
      })
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
      await screen.findByText('Rate limited')

      fireEvent.mouseDown(document.body)
      fireEvent.click(document.body)

      expect(screen.queryByText('Rate limited')).not.toBeInTheDocument()
    })
  })

  describe('cross-instance coordination between multiple AiSuggestButton instances', () => {
    it('disables another instance\'s Suggest button while one instance has a pending, unresolved suggestion', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({ suggestion: 'Suggestion A', pendingApprovals: [] })
      )
      vi.stubGlobal('fetch', fetchMock)

      render(
        <>
          <AiSuggestButton resumeId="r1" currentValue="Notes A" context={{ field: 'summary' }} onAccept={() => {}} />
          <AiSuggestButton resumeId="r1" currentValue="Notes B" context={{ field: 'summary' }} onAccept={() => {}} />
        </>
      )

      const [buttonA, buttonB] = screen.getAllByRole('button')
      fireEvent.click(buttonA)
      await screen.findByText('Suggestion A')

      // Two overlapping pending-suggestion panels (each `fixed`/`z-[100]`,
      // right-aligned the same way) would visually stack on top of each
      // other, and a single Escape keypress would clear both at once since
      // each instance registers its own document-level listener. Only one
      // instance may hold an unresolved pending suggestion at a time.
      expect(buttonB).toBeDisabled()
    })

    it('re-enables other instances once the pending suggestion is resolved via Dismiss', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({ suggestion: 'Suggestion A', pendingApprovals: [] })
      )
      vi.stubGlobal('fetch', fetchMock)

      render(
        <>
          <AiSuggestButton resumeId="r1" currentValue="Notes A" context={{ field: 'summary' }} onAccept={() => {}} />
          <AiSuggestButton resumeId="r1" currentValue="Notes B" context={{ field: 'summary' }} onAccept={() => {}} />
        </>
      )

      const [buttonA, buttonB] = screen.getAllByRole('button')
      fireEvent.click(buttonA)
      await screen.findByText('Suggestion A')
      expect(buttonB).toBeDisabled()

      fireEvent.click(screen.getByText('Dismiss'))

      expect(buttonB).not.toBeDisabled()
    })

    it('does not block the same instance from re-clicking its own Suggest button while its result is pending', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({ suggestion: 'Suggestion A', pendingApprovals: [] })
      )
      vi.stubGlobal('fetch', fetchMock)

      render(
        <AiSuggestButton resumeId="r1" currentValue="Notes A" context={{ field: 'summary' }} onAccept={() => {}} />
      )

      const trigger = screen.getByRole('button', { name: /generate an ai-written suggestion/i })
      fireEvent.click(trigger)
      await screen.findByText('Suggestion A')

      // Once the result panel renders, "Use this"/"Dismiss" are also
      // role="button" — re-query by accessible name so this only asserts
      // on the trigger, not incidentally passing/failing on the wrong button.
      expect(screen.getByRole('button', { name: /generate an ai-written suggestion/i })).not.toBeDisabled()
    })
  })
})
