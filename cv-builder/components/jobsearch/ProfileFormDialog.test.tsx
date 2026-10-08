// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useState } from 'react'
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

function setup(
  edit?: { mode: 'edit'; existingProfile: typeof existing },
  opts: { onSaved?: () => void } = {}
) {
  const onOpenChange = vi.fn()
  const onSaved = vi.fn(opts.onSaved)
  render(
    edit ? (
      <ProfileFormDialog open {...edit} onOpenChange={onOpenChange} onSaved={onSaved} />
    ) : (
      <ProfileFormDialog open mode="create" onOpenChange={onOpenChange} onSaved={onSaved} />
    )
  )
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

  it('restores a versioned draft but ignores a legacy wizard draft and an unversioned one', async () => {
    mockApi()
    writeDraft({ version: 2, step: 1, maxUnlocked: 1, values: { ...emptyValues(), name: 'Restored' } })
    const first = render(<ProfileFormDialog open mode="create" onOpenChange={() => {}} onSaved={() => {}} />)
    expect(screen.getByText('Step 2 of 4: Where')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^1\. Role/ }))
    expect(screen.getByLabelText('Profile name')).toHaveValue('Restored')
    first.unmount()

    window.localStorage.clear()
    window.localStorage.setItem(
      'cv-builder:jobsearch-profile-wizard-draft',
      JSON.stringify({ step: 4, maxUnlocked: 5, values: { name: 'Legacy' } })
    )
    window.localStorage.setItem(
      'cv-builder:jobsearch-profile-form-draft',
      JSON.stringify({ step: 2, maxUnlocked: 2, values: { ...emptyValues(), name: 'Unversioned' } })
    )
    setup()
    expect(screen.getByText('Step 1 of 4: Role')).toBeInTheDocument()
    expect(screen.getByLabelText('Profile name')).toHaveValue('')
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

describe('ProfileFormDialog create, hardening', () => {
  it('does not create the notify rule when the profile POST is rejected', async () => {
    const calls = mockApi({ profile: { ok: false, body: {} } })
    setup()
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    expect(await screen.findByText(/Failed to create profile/)).toBeInTheDocument()
    expect(calls.some((c) => c.url === '/api/jobsearch/rules')).toBe(false)
  })

  it('shows the rule-failure toast only after onSaved was called', async () => {
    mockApi({ rule: { ok: false } })
    const order: string[] = []
    const { onSaved } = setup(undefined, { onSaved: () => order.push(`saved:${useToastStore.getState().toasts.length}`) })
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    await waitFor(() => expect(useToastStore.getState().toasts.length).toBe(1))
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['saved:0'])
  })

  it('does not show the error banner or allow a duplicate create when onSaved throws', async () => {
    const calls = mockApi()
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { onSaved } = setup(undefined, {
      onSaved: () => {
        throw new Error('parent blew up')
      },
    })
    await fillAndReachReview()
    await userEvent.click(screen.getByRole('button', { name: 'Create profile' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument()
    expect(calls.filter((c) => c.url === '/api/jobsearch/profiles' && c.method === 'POST')).toHaveLength(1)
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('focuses the Profile name input on open', async () => {
    mockApi()
    setup()
    await waitFor(() => expect(screen.getByLabelText('Profile name')).toHaveFocus())
  })

  it('focuses the Profile name input when Next is blocked', async () => {
    mockApi()
    setup()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByLabelText('Profile name')).toHaveFocus()
  })

  it('labels the step panel', () => {
    mockApi()
    setup()
    expect(screen.getByRole('group', { name: 'Step 1 of 4: Role' })).toBeInTheDocument()
  })

  it('adds a selected country that was never added with the button when moving on', async () => {
    mockApi()
    setup()
    await userEvent.type(screen.getByLabelText('Profile name'), 'Frontend')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IL')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Israel')).toBeInTheDocument()
  })

  it.each([
    ['the Add location button', async () => userEvent.click(screen.getByRole('button', { name: 'Add location' }))],
    ['the Enter key', async () => userEvent.type(screen.getByLabelText('City'), '{Enter}')],
  ])('does not add a second country-wide entry after adding a city with %s', async (_label, add) => {
    mockApi()
    setup()
    await userEvent.type(screen.getByLabelText('Profile name'), 'Frontend')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IL')
    await userEvent.type(screen.getByLabelText('City'), 'Tel Aviv')
    await add()
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('Tel Aviv, Israel')).toBeInTheDocument()
    expect(readDraft()?.values.locations).toEqual([{ country: 'IL', city: 'Tel Aviv' }])
  })

  it('keeps a changed, never-added country but not the consumed one', async () => {
    mockApi()
    setup()
    await userEvent.type(screen.getByLabelText('Profile name'), 'Frontend')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IL')
    await userEvent.type(screen.getByLabelText('City'), 'Tel Aviv')
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'FR')
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    await userEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(readDraft()?.values.locations).toEqual([{ country: 'IL', city: 'Tel Aviv' }, { country: 'FR' }])
  })

  it('PATCHes exactly one location after adding a city and saving', async () => {
    const calls = mockApi()
    const { onSaved } = setup({ mode: 'edit', existingProfile: { ...existing, locations: [] } })
    await userEvent.click(screen.getByRole('button', { name: /^2\. Where/ }))
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IL')
    await userEvent.type(screen.getByLabelText('City'), 'Tel Aviv')
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    expect(calls.find((c) => c.method === 'PATCH')?.body).toMatchObject({ locations: [{ country: 'IL', city: 'Tel Aviv' }] })
    expect((calls.find((c) => c.method === 'PATCH')?.body as { locations: unknown[] }).locations).toHaveLength(1)
  })

  it('drops a pending duplicate location without an error', async () => {
    const calls = mockApi()
    setup({ mode: 'edit', existingProfile: existing })
    await userEvent.click(screen.getByRole('button', { name: /^2\. Where/ }))
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IL')
    await userEvent.type(screen.getByLabelText('City'), 'tel aviv')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true))
    const patch = calls.find((c) => c.method === 'PATCH')
    expect(patch?.body).toMatchObject({ locations: [{ country: 'IL', city: 'Tel Aviv' }] })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('ProfileFormDialog edit', () => {
  it('rejects a cleared name on Save changes without sending anything', async () => {
    const calls = mockApi()
    const { onSaved } = setup({ mode: 'edit', existingProfile: existing })
    await userEvent.clear(screen.getByLabelText('Profile name'))
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for this profile.')
    expect(calls.some((c) => c.method === 'PATCH')).toBe(false)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('PATCHes a typed city that was never added with the button', async () => {
    const calls = mockApi()
    const { onSaved } = setup({ mode: 'edit', existingProfile: existing })
    await userEvent.click(screen.getByRole('button', { name: /^2\. Where/ }))
    await userEvent.type(screen.getByLabelText('City'), 'Haifa')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalled())
    const patch = calls.find((c) => c.method === 'PATCH')
    expect(patch?.body).toMatchObject({ locations: [{ country: 'IL', city: 'Tel Aviv' }, { city: 'Haifa' }] })
  })

  it('ignores Escape while the discard confirmation is shown and focuses Keep editing', async () => {
    mockApi()
    const { onOpenChange } = setup({ mode: 'edit', existingProfile: existing })
    await userEvent.type(screen.getByLabelText('Target roles'), 'Vue developer{Enter}')
    await userEvent.keyboard('{Escape}')
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument()
  })

  it('disables Cancel and ignores close requests while saving', async () => {
    mockApi()
    let release: (value: unknown) => void = () => {}
    const gate = new Promise((resolve) => {
      release = resolve
    })
    const base = vi.mocked(fetch)
    const { onOpenChange } = setup({ mode: 'edit', existingProfile: existing })
    base.mockImplementationOnce(async () => {
      await gate
      return { ok: true, json: async () => ({ profile: { _id: 'p1', name: 'Frontend' } }) } as Response
    })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).not.toHaveBeenCalled()
    release(undefined)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled())
  })

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

describe('ProfileFormDialog returnFocusTo', () => {
  it('focuses the given element when the dialog closes', async () => {
    mockApi()
    const trigger = document.createElement('button')
    trigger.textContent = 'Opener'
    document.body.appendChild(trigger)
    function Host() {
      const [open, setOpen] = useState(true)
      return <ProfileFormDialog open={open} mode="create" returnFocusTo={trigger} onOpenChange={setOpen} onSaved={() => {}} />
    }
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(trigger).toHaveFocus())
    trigger.remove()
  })
})

describe('ProfileFormDialog footer', () => {
  it('right-aligns the action group when the footer wraps', () => {
    mockApi()
    setup({ mode: 'edit', existingProfile: existing })
    const group = screen.getByRole('button', { name: 'Save changes' }).parentElement!
    expect(group).toHaveClass('ml-auto', 'flex-wrap')
  })
})

describe('ProfileFormDialog focus fallback', () => {
  it('falls back to the focused-at-mount element when returnFocusTo is disconnected', async () => {
    mockApi()
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const gone = document.createElement('button')
    function Host() {
      const [open, setOpen] = useState(true)
      return <ProfileFormDialog open={open} mode="create" returnFocusTo={gone} onOpenChange={setOpen} onSaved={() => {}} />
    }
    render(<Host />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(opener).toHaveFocus())
    opener.remove()
  })
})
