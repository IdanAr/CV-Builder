// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileFormDialog } from './ProfileFormDialog'
import { useToastStore } from '@/lib/stores/toast.store'
import { writeDraft, emptyValues, readDraft } from './profile-form/model'

type Reply = { ok: boolean; body?: unknown }
function mockApi(replies: { profile?: Reply; rule?: Reply } = {}) {
  const calls: { url: string; method: string; body?: unknown }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET'
      calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined })
      if (url === '/api/resumes') return { ok: true, json: async () => ({ resumes: [{ _id: 'r1', title: 'Senior frontend CV' }] }) }
      if (url.startsWith('/api/jobsearch/profiles')) {
        const r = replies.profile ?? { ok: true, body: { profile: { _id: 'p1', name: 'Frontend' } } }
        return { ok: r.ok, json: async () => r.body ?? { profile: { _id: 'p1', name: 'Frontend' } } }
      }
      if (url === '/api/jobsearch/rules') {
        const r = replies.rule ?? { ok: true, body: {} }
        return { ok: r.ok, json: async () => r.body ?? {} }
      }
      throw new Error(`unexpected fetch ${url}`)
    })
  )
  return calls
}

const existing = {
  _id: 'p1', name: 'Frontend', roles: ['React developer'], workModes: ['remote' as const],
  locations: [{ country: 'IL', city: 'Tel Aviv' }], seniority: ['senior' as const], categories: [], industries: [],
  recencyDays: 14, minAtsScore: 75,
}

function setup(props: Partial<React.ComponentProps<typeof ProfileFormDialog>> = {}) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn()
  render(<ProfileFormDialog open mode="create" onOpenChange={onOpenChange} onSaved={onSaved} {...props} />)
  return { onOpenChange, onSaved }
}

async function fillAndReachReview() {
  await userEvent.type(screen.getByLabelText('Profile name'), 'Frontend')
  await userEvent.type(screen.getByLabelText('Target roles'), 'React developer{Enter}')
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
  await userEvent.click(screen.getByRole('button', { name: 'Next' }))
}

beforeEach(() => {
  window.localStorage.clear()
  useToastStore.setState({ toasts: [] })
})

describe('ProfileFormDialog create', () => {
  it('walks four steps and posts the profile, then the notify rule', async () => {
    const calls = mockApi()
    const { onSaved } = setup()
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ _id: 'p1', name: 'Frontend' }))
    const post = calls.find((c) => c.url === '/api/jobsearch/profiles' && c.method === 'POST')
    expect(post?.body).toMatchObject({ name: 'Frontend', roles: ['React developer'], locations: [] })
    expect(post?.body).not.toHaveProperty('notifyOnMatch')
    const rule = calls.find((c) => c.url === '/api/jobsearch/rules')
    expect(rule?.body).toMatchObject({ profileId: 'p1', action: 'notify', conditions: [{ field: 'atsScore', op: 'gte', value: 75 }] })
    expect(readDraft()).toBeNull()
  })

  it('skips the rule when the notify box is unchecked', async () => {
    const calls = mockApi()
    const { onSaved } = setup()
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('checkbox', { name: /Notify me/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(calls.some((c) => c.url === '/api/jobsearch/rules')).toBe(false)
  })

  it('keeps the created profile and warns when only the rule fails', async () => {
    mockApi({ rule: { ok: false } })
    const { onSaved } = setup()
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(useToastStore.getState().toasts.some((t) => /notify rule/i.test(t.message))).toBe(true)
  })

  it('shows the server message and stays open when the profile is rejected', async () => {
    mockApi({ profile: { ok: false, body: { details: [{ path: ['locations'], message: 'Too big' }] } } })
    const { onSaved } = setup()
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(await screen.findByText(/Failed to create profile\. locations: Too big/)).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('blocks Next without a name and shows the error on step 1', async () => {
    mockApi()
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for this profile.')
    expect(screen.getByText('Step 1 of 4: Role')).toBeInTheDocument()
  })

  it('sends the user back to step 1 if they jump to Review with a cleared name', async () => {
    mockApi()
    setup()
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: 'Edit roles' }))
    await userEvent.clear(screen.getByLabelText('Profile name'))
    await userEvent.click(screen.getByRole('button', { name: /^4\. Review/ }))
    expect(await screen.findByText('Enter a name for this profile.')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 4: Role')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create profile' })).not.toBeInTheDocument()
  })

  it('locks later steps until they have been reached', () => {
    mockApi()
    setup()
    expect(screen.getByRole('button', { name: /^3\. Sources/ })).toBeDisabled()
  })

  it('restores a saved create draft and ignores a six-step wizard draft', () => {
    mockApi()
    writeDraft({ version: 2, step: 1, maxUnlocked: 1, values: { ...emptyValues(), name: 'Restored' } })
    setup()
    expect(screen.getByText('Step 2 of 4: Where')).toBeInTheDocument()
  })

  it('keeps the draft on close without asking for confirmation', async () => {
    mockApi()
    const { onOpenChange } = setup()
    await userEvent.type(screen.getByLabelText('Profile name'), 'Half done')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(readDraft()?.values.name).toBe('Half done')
  })

  it('renders nothing while closed', () => {
    mockApi()
    render(<ProfileFormDialog open={false} mode="create" onOpenChange={() => {}} onSaved={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('ProfileFormDialog edit', () => {
  it('opens prefilled with every step reachable and no notify checkbox', async () => {
    mockApi()
    setup({ mode: 'edit', existingProfile: existing })
    expect(screen.getByLabelText('Profile name')).toHaveValue('Frontend')
    expect(screen.getByRole('button', { name: /^4\. Review/ })).not.toBeDisabled()
    await userEvent.click(screen.getByRole('button', { name: /^4\. Review/ }))
    expect(screen.queryByRole('checkbox', { name: /Notify me/ })).not.toBeInTheDocument()
  })

  it('shows Save changes on every step and PATCHes the profile without touching the draft or rules', async () => {
    const calls = mockApi()
    const { onSaved } = setup({ mode: 'edit', existingProfile: existing })
    await userEvent.type(screen.getByLabelText('Target roles'), 'Vue developer{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const patch = calls.find((c) => c.method === 'PATCH')
    expect(patch?.url).toBe('/api/jobsearch/profiles/p1')
    expect(patch?.body).toMatchObject({ roles: ['React developer', 'Vue developer'] })
    expect(calls.some((c) => c.url === '/api/jobsearch/rules')).toBe(false)
    expect(readDraft()).toBeNull()
  })

  it('asks before discarding edits, and closes straight away when nothing changed', async () => {
    mockApi()
    const { onOpenChange } = setup({ mode: 'edit', existingProfile: existing })
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)

    onOpenChange.mockClear()
    await userEvent.type(screen.getByLabelText('Target roles'), 'Vue developer{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.queryByText('Discard your changes?')).not.toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
