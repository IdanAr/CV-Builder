// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProfileWizard } from './ProfileWizard'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('ProfileWizard', () => {
  it('starts on step 1 and advances to step 6 via Next', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Roles')
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Review')
  })

  it('disables the create button until a profile name is entered', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    expect(screen.getByRole('button', { name: /create profile/i })).toBeDisabled()
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Frontend, Remote EU')
    expect(screen.getByRole('button', { name: /create profile/i })).toBeEnabled()
  })

  it('shows a confirmation offering a default notify rule after profile creation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { _id: 'p1', name: 'Frontend, Remote EU' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Frontend, Remote EU')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    expect(mockFetch).toHaveBeenCalledWith('/api/jobsearch/profiles', expect.objectContaining({ method: 'POST' }))
    expect(await screen.findByText(/profile created/i)).toBeInTheDocument()
  })

  it('calls onCreated immediately when the user skips the default rule offer', async () => {
    const onCreated = vi.fn()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { _id: 'p1', name: 'Test' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={onCreated} />)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))
    await userEvent.click(await screen.findByRole('button', { name: /skip/i }))

    expect(onCreated).toHaveBeenCalledWith({ _id: 'p1', name: 'Test' })
  })

  it('creates a default notify rule at the profile\'s threshold and then calls onCreated when the user accepts', async () => {
    const onCreated = vi.fn()
    const mockFetch = vi.fn((url: string, _opts?: { method?: string; body?: string }) => {
      if (url === '/api/jobsearch/profiles') return Promise.resolve({ ok: true, json: async () => ({ profile: { _id: 'p1', name: 'Test' } }) })
      if (url === '/api/jobsearch/rules') return Promise.resolve({ ok: true, json: async () => ({ rule: { _id: 'r1' } }) })
      return Promise.resolve({ ok: true, json: async () => ({ resumes: [] }) })
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={onCreated} />)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))
    await userEvent.click(await screen.findByRole('button', { name: /yes, notify me/i }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ _id: 'p1', name: 'Test' }))
    expect(mockFetch).toHaveBeenCalledWith('/api/jobsearch/rules', expect.objectContaining({ method: 'POST' }))
    const ruleCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/rules')
    const body = JSON.parse(ruleCall![1]!.body!)
    expect(body).toEqual(
      expect.objectContaining({
        profileId: 'p1',
        action: 'notify',
        conditions: [{ field: 'atsScore', op: 'gte', value: 75 }],
      })
    )
  })

  it('shows an inline error and does not silently proceed when the default rule POST resolves with a non-ok status', async () => {
    const onCreated = vi.fn()
    const mockFetch = vi.fn((url: string, _opts?: { method?: string; body?: string }) => {
      if (url === '/api/jobsearch/profiles') return Promise.resolve({ ok: true, json: async () => ({ profile: { _id: 'p1', name: 'Test' } }) })
      if (url === '/api/jobsearch/rules') return Promise.resolve({ ok: false, json: async () => ({}) })
      return Promise.resolve({ ok: true, json: async () => ({ resumes: [] }) })
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={onCreated} />)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))
    await userEvent.click(await screen.findByRole('button', { name: /yes, notify me/i }))

    expect(await screen.findByText(/couldn.t create the notify rule/i)).toBeInTheDocument()
    // The failure isn't silent, but it also isn't a hard block — the
    // profile was already created, so the user must still be able to
    // leave via Skip rather than being auto-advanced or stranded.
    expect(onCreated).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: /skip/i }))
    expect(onCreated).toHaveBeenCalledWith({ _id: 'p1', name: 'Test' })
  })

  it('preserves city input when navigating away and back to step 2', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    // Navigate to step 2
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    // Type a city
    const cityInput = screen.getByLabelText(/city/i) as HTMLInputElement
    await userEvent.type(cityInput, 'Berlin')
    expect(cityInput.value).toBe('Berlin')
    // Navigate to step 4
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    // Click back to step 2 via tab
    await userEvent.click(screen.getByRole('tab', { name: /location/i }))
    // Verify city is still there
    const cityInputAfter = screen.getByLabelText(/city/i) as HTMLInputElement
    expect(cityInputAfter.value).toBe('Berlin')
  })

  it('displays an error message when profile creation fails', async () => {
    const onCreated = vi.fn()
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={onCreated} />)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Frontend, Remote EU')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    expect(screen.getByText(/failed to create profile/i)).toBeInTheDocument()
    expect(onCreated).not.toHaveBeenCalled()
  })

  it('allows typing multi-word roles without stripping spaces mid-typing', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    const rolesInput = screen.getByLabelText(/target roles/i) as HTMLInputElement
    await userEvent.type(rolesInput, 'Data Analyst')
    expect(rolesInput.value).toBe('Data Analyst')
  })

  it('allows typing categories with commas and spaces without stripping them', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i })) // -> step 2
    await userEvent.click(screen.getByRole('button', { name: /next/i })) // -> step 3
    const categoriesInput = screen.getByLabelText(/^categories/i) as HTMLInputElement
    await userEvent.type(categoriesInput, 'Backend Engineering, Site Reliability')
    expect(categoriesInput.value).toBe('Backend Engineering, Site Reliability')
  })

  it('parses multi-word, comma-separated roles into tags on submit', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { _id: 'p1', name: 'Test' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.type(screen.getByLabelText(/target roles/i), 'Data Analyst, Product Manager')
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    const profileCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/profiles')
    const body = JSON.parse(profileCall![1].body)
    expect(body.roles).toEqual(['Data Analyst', 'Product Manager'])
  })

  it('offers seniority as checkboxes and includes toggled levels in the submitted payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ profile: { _id: 'p1', name: 'Test' } }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /^senior$/i }))
    await userEvent.click(screen.getByRole('checkbox', { name: /^staff$/i }))
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    const profileCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/profiles')
    const body = JSON.parse(profileCall![1].body)
    expect(body.seniority).toEqual(['senior', 'staff'])
  })

  it('shows a summary of set preferences on the review step', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.type(screen.getByLabelText(/target roles/i), 'Data Analyst')
    await userEvent.click(screen.getByRole('checkbox', { name: /^senior$/i }))
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    expect(screen.getByText('Data Analyst')).toBeInTheDocument()
    expect(screen.getByText('senior')).toBeInTheDocument()
  })

  it('clamps recencyDays to at least 1 when the field is cleared', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    const recencyInput = screen.getByLabelText(/last n days/i) as HTMLInputElement
    await userEvent.clear(recencyInput)
    expect(Number(recencyInput.value)).toBeGreaterThanOrEqual(1)
  })

  it('surfaces the specific validation error when profile creation is rejected', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: [{ path: ['recencyDays'], message: 'Too small: expected number to be >=1' }],
      }),
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    for (let i = 0; i < 5; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    expect(screen.getByText(/recencyDays: Too small/i)).toBeInTheDocument()
  })

  it('shows a Back button that returns to the previous step', async () => {
    render(<ProfileWizard onCreated={() => {}} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Focus')
    await userEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Location')
  })

  it('offers the user\'s résumés on the threshold step and includes the chosen one in the submitted payload', async () => {
    const mockFetch = vi.fn((url: string, _opts?: { method?: string; body?: string }) => {
      if (url === '/api/resumes') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ resumes: [{ _id: 'r1', title: 'Frontend Resume' }, { _id: 'r2', title: 'Backend Resume' }] }),
        })
      }
      return Promise.resolve({ ok: true, json: async () => ({ profile: { _id: 'p1', name: 'Test' } }) })
    })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    const resumeSelect = await screen.findByLabelText(/résumé to tailor from/i)
    expect(await screen.findByRole('option', { name: 'Backend Resume' })).toBeInTheDocument()
    await userEvent.selectOptions(resumeSelect, 'r2')

    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    const profileCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/profiles')
    const body = JSON.parse(profileCall![1]!.body!)
    expect(body.resumeId).toBe('r2')
  })

  it('includes the selected country in the submitted payload', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ profile: { _id: 'p1', name: 'Test' } }) })
    vi.stubGlobal('fetch', mockFetch)

    render(<ProfileWizard onCreated={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: /next/i })) // -> step 2
    await userEvent.selectOptions(screen.getByLabelText(/country/i), 'IL')
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
    await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

    const profileCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/profiles')
    const body = JSON.parse(profileCall![1].body)
    expect(body.locations).toEqual([{ country: 'IL' }])
  })

  it('edit mode: pre-fills from existingProfile and PATCHes instead of POSTing on save', async () => {
    const onUpdated = vi.fn()
    const onCreated = vi.fn()
    const mockFetch = vi.fn((url: string, _opts?: { method?: string; body?: string }) => {
      if (url === '/api/jobsearch/profiles/p1') {
        return Promise.resolve({ ok: true, json: async () => ({ profile: { _id: 'p1', name: 'Updated Name' } }) })
      }
      return Promise.resolve({ ok: true, json: async () => ({ resumes: [] }) })
    })
    vi.stubGlobal('fetch', mockFetch)

    const existingProfile = {
      _id: 'p1',
      name: 'Original Name',
      roles: ['Data Analyst'],
      workModes: ['remote' as const],
      locations: [{ country: 'IL', city: 'Tel Aviv' }],
      seniority: ['senior' as const],
      categories: ['Fintech'],
      industries: [],
      recencyDays: 7,
      minAtsScore: 60,
    }

    render(<ProfileWizard onCreated={onCreated} onUpdated={onUpdated} existingProfile={existingProfile} />)

    expect(screen.getByLabelText(/target roles/i)).toHaveValue('Data Analyst')
    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByLabelText(/^city$/i)).toHaveValue('Tel Aviv')
    for (let i = 0; i < 4; i++) {
      await userEvent.click(screen.getByRole('button', { name: /next/i }))
    }
    expect(screen.getByLabelText(/profile name/i)).toHaveValue('Original Name')

    await userEvent.clear(screen.getByLabelText(/profile name/i))
    await userEvent.type(screen.getByLabelText(/profile name/i), 'Updated Name')
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith({ _id: 'p1', name: 'Updated Name' }))
    expect(onCreated).not.toHaveBeenCalled()
    const patchCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/profiles/p1')
    expect(patchCall![1]).toEqual(expect.objectContaining({ method: 'PATCH' }))
  })

  describe('Sources step (watched Comeet companies)', () => {
    async function goToSourcesStep() {
      render(<ProfileWizard onCreated={() => {}} />)
      for (let i = 0; i < 3; i++) {
        await userEvent.click(screen.getByRole('button', { name: /next/i }))
      }
      expect(screen.getByRole('tab', { selected: true })).toHaveTextContent('Sources')
    }

    function stubFetch(overrides?: { resolveOk?: boolean; resolveError?: string }) {
      const mockFetch = vi.fn().mockImplementation((url: string) => {
        if (url === '/api/jobsearch/comeet/resolve') {
          if (overrides?.resolveOk === false) {
            return Promise.resolve({
              ok: false,
              json: async () => ({ error: overrides?.resolveError ?? 'Could not resolve that URL.' }),
            })
          }
          return Promise.resolve({
            ok: true,
            json: async () => ({ company: { name: 'Acme Israel', uid: 'ACM.001', token: 'tok_abc' } }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({ profile: { _id: 'p1', name: 'Test' } }) })
      })
      vi.stubGlobal('fetch', mockFetch)
      return mockFetch
    }

    it('resolves a pasted careers page URL and includes the company in the submitted payload', async () => {
      const mockFetch = stubFetch()

      await goToSourcesStep()
      await userEvent.type(
        screen.getByLabelText(/careers page url/i),
        'https://www.comeet.com/jobs/acme/ACM.001'
      )
      await userEvent.click(screen.getByRole('button', { name: /add company/i }))
      await waitFor(() => expect(screen.getByText('Acme Israel')).toBeInTheDocument())

      for (let i = 0; i < 2; i++) {
        await userEvent.click(screen.getByRole('button', { name: /next/i }))
      }
      await userEvent.type(screen.getByLabelText(/profile name/i), 'Test')
      await userEvent.click(screen.getByRole('button', { name: /create profile/i }))

      const resolveCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/comeet/resolve')
      expect(JSON.parse(resolveCall![1].body)).toEqual({ url: 'https://www.comeet.com/jobs/acme/ACM.001' })
      const profileCall = mockFetch.mock.calls.find((c) => c[0] === '/api/jobsearch/profiles')
      const body = JSON.parse(profileCall![1].body)
      expect(body.comeetCompanies).toEqual([{ name: 'Acme Israel', uid: 'ACM.001', token: 'tok_abc' }])
    })

    it('shows an inline error and adds nothing when resolution fails', async () => {
      stubFetch({ resolveOk: false, resolveError: 'Could not find company data on that page.' })

      await goToSourcesStep()
      await userEvent.type(screen.getByLabelText(/careers page url/i), 'https://www.comeet.com/jobs/nope/1')
      await userEvent.click(screen.getByRole('button', { name: /add company/i }))

      expect(await screen.findByText('Could not find company data on that page.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
    })

    it('removes a resolved company via its Remove button', async () => {
      stubFetch()

      await goToSourcesStep()
      await userEvent.type(
        screen.getByLabelText(/careers page url/i),
        'https://www.comeet.com/jobs/acme/ACM.001'
      )
      await userEvent.click(screen.getByRole('button', { name: /add company/i }))
      await waitFor(() => expect(screen.getByText('Acme Israel')).toBeInTheDocument())

      await userEvent.click(screen.getByRole('button', { name: /remove/i }))
      expect(screen.queryByText('Acme Israel')).not.toBeInTheDocument()
    })
  })
})
