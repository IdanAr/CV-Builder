// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { emptyValues, type ProfileFormValues } from './model'
import { StepRole } from './StepRole'
import { StepWhere } from './StepWhere'
import { StepSources } from './StepSources'
import { MAX_COMEET_COMPANIES } from '@/lib/schemas/jobsearch.zod'
import { StepReview } from './StepReview'

function Stateful({ children, initial }: { initial?: Partial<ProfileFormValues>; children: (v: ProfileFormValues, c: (p: Partial<ProfileFormValues>) => void) => React.ReactNode }) {
  const [values, setValues] = useState<ProfileFormValues>({ ...emptyValues(), ...initial })
  return <>{children(values, (patch) => setValues((v) => ({ ...v, ...patch })))}</>
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('StepRole', () => {
  it('collects name, roles and seniority and shows a name error', async () => {
    render(<Stateful>{(v, c) => <StepRole values={v} onChange={c} nameError="Enter a name for this profile." />}</Stateful>)
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name for this profile.')
    await userEvent.type(screen.getByLabelText('Profile name'), 'Frontend')
    await userEvent.type(screen.getByLabelText('Target roles'), 'React developer{Enter}')
    await userEvent.click(screen.getByRole('button', { name: 'senior' }))
    expect(screen.getByText('React developer')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'senior' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('StepWhere', () => {
  it('toggles work modes', async () => {
    render(<Stateful>{(v, c) => <StepWhere values={v} onChange={c} />}</Stateful>)
    await userEvent.click(screen.getByRole('button', { name: 'remote' }))
    expect(screen.getByRole('button', { name: 'remote' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('adds several locations as tags labelled "City, Country"', async () => {
    render(<Stateful>{(v, c) => <StepWhere values={v} onChange={c} />}</Stateful>)
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IL')
    await userEvent.type(screen.getByLabelText('City'), 'Tel Aviv')
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))
    await userEvent.type(screen.getByLabelText('City'), 'Herzliya{Enter}')
    expect(screen.getByText('Tel Aviv, Israel')).toBeInTheDocument()
    expect(screen.getByText('Herzliya, Israel')).toBeInTheDocument()
    expect(screen.getByText('2 of 5 locations')).toBeInTheDocument()
  })

  it('rejects a duplicate with an inline message and removes a tag', async () => {
    render(<Stateful initial={{ locations: [{ country: 'IL', city: 'Tel Aviv' }] }}>{(v, c) => <StepWhere values={v} onChange={c} />}</Stateful>)
    await userEvent.selectOptions(screen.getByLabelText('Country'), 'IL')
    await userEvent.type(screen.getByLabelText('City'), 'tel aviv')
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))
    expect(screen.getByRole('alert')).toHaveTextContent('That location is already in the list.')
    await userEvent.click(screen.getByRole('button', { name: 'Remove Tel Aviv, Israel' }))
    expect(screen.queryByText('Tel Aviv, Israel')).not.toBeInTheDocument()
  })

  it('renders legacy duplicate locations without key collisions', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Stateful initial={{ locations: [{ city: 'Haifa' }, { city: 'Haifa' }] }}>{(v, c) => <StepWhere values={v} onChange={c} />}</Stateful>)
    expect(screen.getAllByText('Haifa')).toHaveLength(2)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('asks for something to add when both fields are empty', async () => {
    render(<Stateful>{(v, c) => <StepWhere values={v} onChange={c} />}</Stateful>)
    await userEvent.click(screen.getByRole('button', { name: 'Add location' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a country or enter a city.')
  })
})

describe('StepSources', () => {
  it('resolves a Comeet URL into a company tag and clears the field', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ company: { name: 'Wix', uid: 'u1', token: 't1' } }) } as Response)
    render(<Stateful>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    const input = screen.getByLabelText('Company careers page URL')
    await userEvent.type(input, 'https://www.comeet.com/jobs/wix/u1')
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
    expect(await screen.findByText('Wix')).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/jobsearch/comeet/resolve', expect.objectContaining({ method: 'POST' }))
  })

  it('shows the server message when the lookup fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'No Comeet page found at that URL.' }) } as Response)
    render(<Stateful>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    await userEvent.type(screen.getByLabelText('Company careers page URL'), 'https://x.test')
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No Comeet page found at that URL.')
  })

  it('refuses a company that is already watched', async () => {
    render(<Stateful initial={{ comeetCompanies: [{ name: 'Wix', uid: 'u1', token: 't1' }] }}>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    await userEvent.type(screen.getByLabelText('Company careers page URL'), 'https://www.comeet.com/jobs/wix/u1')
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
    expect(screen.getByRole('alert')).toHaveTextContent('That company is already in the list.')
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('uses the current list after the lookup, so a tag removed meanwhile stays removed', async () => {
    let resolve: (value: Response) => void = () => {}
    vi.mocked(fetch).mockReturnValueOnce(new Promise<Response>((r) => (resolve = r)))
    render(<Stateful initial={{ comeetCompanies: [{ name: 'Wix', uid: 'u1', token: 't1' }] }}>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    await userEvent.type(screen.getByLabelText('Company careers page URL'), 'https://x.test')
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
    await userEvent.click(screen.getByRole('button', { name: 'Remove Wix' }))
    resolve({ ok: true, json: async () => ({ company: { name: 'Monday', uid: 'u2', token: 't2' } }) } as Response)
    expect(await screen.findByText('Monday')).toBeInTheDocument()
    expect(screen.queryByText('Wix')).not.toBeInTheDocument()
  })

  it('shows a generic message when the lookup request fails', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network'))
    render(<Stateful>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    await userEvent.type(screen.getByLabelText('Company careers page URL'), 'https://x.test')
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not look up that page. Try again.')
  })

  it('refuses another company once the cap is reached', async () => {
    const full = Array.from({ length: MAX_COMEET_COMPANIES }, (_, i) => ({ name: `Co ${i}`, uid: `u${i}`, token: 't' }))
    render(<Stateful initial={{ comeetCompanies: full }}>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    await userEvent.type(screen.getByLabelText('Company careers page URL'), 'https://x.test')
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
    expect(screen.getByRole('alert')).toHaveTextContent(`You can watch up to ${MAX_COMEET_COMPANIES} companies.`)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled()
  })

  it('rejects a response whose company is already watched', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, json: async () => ({ company: { name: 'Wix', uid: 'u1', token: 't1' } }) } as Response)
    render(<Stateful initial={{ comeetCompanies: [{ name: 'Wix', uid: 'u1', token: 't1' }] }}>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    await userEvent.type(screen.getByLabelText('Company careers page URL'), 'https://other.test/page')
    await userEvent.click(screen.getByRole('button', { name: 'Add company' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('That company is already in the list.')
    expect(screen.getAllByText('Wix')).toHaveLength(1)
  })

  it('renders legacy duplicate companies without key collisions', () => {
    const dup = { name: 'Wix', uid: 'u1', token: 't1' }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Stateful initial={{ comeetCompanies: [dup, dup] }}>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    expect(screen.getAllByText('Wix')).toHaveLength(2)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('collects categories and industries as tags', async () => {
    render(<Stateful>{(v, c) => <StepSources values={v} onChange={c} />}</Stateful>)
    await userEvent.type(screen.getByLabelText('Categories'), 'Engineering{Enter}')
    await userEvent.type(screen.getByLabelText('Industries'), 'Fintech{Enter}')
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('Fintech')).toBeInTheDocument()
  })
})

describe('StepReview', () => {
  const resumeOptions = [{ id: 'r1', title: 'Senior frontend CV' }]
  const base = { resumeOptions, isEditing: false, onJumpTo: () => {} }

  it('summarises every location and offers Edit shortcuts', async () => {
    const onJumpTo = vi.fn()
    render(
      <Stateful initial={{ name: 'P', roles: ['React developer'], locations: [{ country: 'IL', city: 'Tel Aviv' }, { country: 'IL', city: 'Herzliya' }] }}>
        {(v, c) => <StepReview values={v} onChange={c} {...base} onJumpTo={onJumpTo} />}
      </Stateful>
    )
    expect(screen.getByText('Tel Aviv, Israel; Herzliya, Israel')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Edit roles' }))
    expect(onJumpTo).toHaveBeenCalledWith(0)
  })

  it('selects a recency preset and shows a stored custom value as an extra chip', async () => {
    render(<Stateful initial={{ recencyDays: 21 }}>{(v, c) => <StepReview values={v} onChange={c} {...base} />}</Stateful>)
    expect(screen.getByRole('button', { name: '21 days' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: '30 days' }))
    expect(screen.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('updates the fit value and hint from the slider', () => {
    render(<Stateful>{(v, c) => <StepReview values={v} onChange={c} {...base} />}</Stateful>)
    const slider = screen.getByLabelText(/Minimum fit/)
    expect(screen.getByText(/^Balanced/)).toBeInTheDocument()
    // fireEvent because user-event cannot drag a range input
    fireEvent.change(slider, { target: { value: '90' } })
    expect(screen.getByText(/^Strict/)).toBeInTheDocument()
  })

  it('offers the notify checkbox on create and hides it when editing', async () => {
    const { rerender } = render(<Stateful>{(v, c) => <StepReview values={v} onChange={c} {...base} />}</Stateful>)
    const box = screen.getByRole('checkbox', { name: /Notify me when a match scores 75% or higher/ })
    expect(box).toBeChecked()
    await userEvent.click(box)
    expect(box).not.toBeChecked()
    rerender(<Stateful>{(v, c) => <StepReview values={v} onChange={c} {...base} isEditing />}</Stateful>)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('lists résumés and defaults to the most recently updated', () => {
    render(<Stateful>{(v, c) => <StepReview values={v} onChange={c} {...base} />}</Stateful>)
    const select = screen.getByLabelText('Résumé to tailor from')
    expect(within(select).getByRole('option', { name: 'Most recently updated' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Senior frontend CV' })).toBeInTheDocument()
  })
})
