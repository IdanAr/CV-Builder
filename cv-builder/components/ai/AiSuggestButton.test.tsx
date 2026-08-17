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
})
