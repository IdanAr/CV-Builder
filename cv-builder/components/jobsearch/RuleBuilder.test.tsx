// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RuleBuilder } from './RuleBuilder'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('RuleBuilder', () => {
  it('lists rules fetched on mount', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        rules: [
          { _id: 'r1', name: 'High fit', isActive: true, action: 'notify', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] },
        ],
      }),
    } as Response)

    render(<RuleBuilder profileId="p1" />)

    expect(await screen.findByText('High fit')).toBeInTheDocument()
    expect(screen.getByText(/notify/i)).toBeInTheDocument()
  })

  it('shows an empty state with an Add rule button when there are no rules yet', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ rules: [] }) } as Response)

    render(<RuleBuilder profileId="p1" />)

    expect(await screen.findByRole('button', { name: /add rule/i })).toBeInTheDocument()
    expect(screen.getByText(/no rules yet/i)).toBeInTheDocument()
  })

  it('creates an atsScore rule and reloads the list', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rules: [] }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rule: { _id: 'r1' } }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        rules: [{ _id: 'r1', name: 'High fit', isActive: true, action: 'notify', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<RuleBuilder profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /add rule/i }))
    await userEvent.type(screen.getByLabelText(/rule name/i), 'High fit')
    await userEvent.click(screen.getByRole('button', { name: /save rule/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/jobsearch/rules', expect.objectContaining({ method: 'POST' }))
    )
    const body = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(body).toEqual(
      expect.objectContaining({
        profileId: 'p1',
        name: 'High fit',
        action: 'notify',
        conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
      })
    )
    expect(await screen.findByText('High fit')).toBeInTheDocument()
  })

  it('creates a company rule from comma-separated text without stripping spaces mid-typing', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rules: [] }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rule: { _id: 'r1' } }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rules: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<RuleBuilder profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /add rule/i }))
    await userEvent.type(screen.getByLabelText(/rule name/i), 'Block competitors')
    await userEvent.selectOptions(screen.getByLabelText(/when a posting matches/i), 'company')
    const companyInput = screen.getByLabelText(/company names/i) as HTMLInputElement
    await userEvent.type(companyInput, 'Big Corp, Other Co')
    expect(companyInput.value).toBe('Big Corp, Other Co')
    await userEvent.selectOptions(screen.getByLabelText(/^then$/i), 'ignore')
    await userEvent.click(screen.getByRole('button', { name: /save rule/i }))

    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(3))
    const body = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(body.conditions).toEqual([{ field: 'company', op: 'in', value: ['Big Corp', 'Other Co'] }])
    expect(body.action).toBe('ignore')
  })

  it("toggles a rule's active state", async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rules: [{ _id: 'r1', name: 'High fit', isActive: true, action: 'notify', conditions: [] }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rule: { _id: 'r1' } }) })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rules: [{ _id: 'r1', name: 'High fit', isActive: false, action: 'notify', conditions: [] }] }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<RuleBuilder profileId="p1" />)
    await userEvent.click(await screen.findByLabelText(/high fit active/i))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        '/api/jobsearch/rules/r1',
        expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ isActive: false }) })
      )
    )
  })

  it('deletes a rule', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rules: [{ _id: 'r1', name: 'High fit', isActive: true, action: 'notify', conditions: [] }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rules: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<RuleBuilder profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))

    await waitFor(() =>
      expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/jobsearch/rules/r1', expect.objectContaining({ method: 'DELETE' }))
    )
  })

  it('shows a full error view with a retry button when the initial load fails', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ rules: [] }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<RuleBuilder profileId="p1" />)

    expect(await screen.findByText(/failed to load rules/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    expect(await screen.findByRole('button', { name: /add rule/i })).toBeInTheDocument()
  })

  it('shows an error banner without clearing the list when deleting fails', async () => {
    const mockFetch = vi.fn()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ rules: [{ _id: 'r1', name: 'High fit', isActive: true, action: 'notify', conditions: [] }] }),
    })
    mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    vi.stubGlobal('fetch', mockFetch)

    render(<RuleBuilder profileId="p1" />)
    await userEvent.click(await screen.findByRole('button', { name: /delete/i }))

    expect(await screen.findByText(/failed to delete rule/i)).toBeInTheDocument()
    expect(screen.getByText('High fit')).toBeInTheDocument()
  })
})
