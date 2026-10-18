// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ConnectedAccountsSection } from './ConnectedAccountsSection'

const actions = { connectAction: vi.fn(), disconnectAction: vi.fn() }

function rowFor(label: string) {
  return screen.getByText(label, { selector: 'span' }).closest('li') as HTMLElement
}

describe('ConnectedAccountsSection', () => {
  it('offers Connect for providers not yet linked and Remove for linked ones', () => {
    render(<ConnectedAccountsSection linked={['github', 'google']} {...actions} />)
    expect(within(rowFor('GitHub')).getByRole('button', { name: 'Remove' })).toBeEnabled()
    expect(within(rowFor('Google')).getByRole('button', { name: 'Remove' })).toBeEnabled()
  })

  it('will not offer to remove the only sign-in method', () => {
    render(<ConnectedAccountsSection linked={['github']} {...actions} />)
    expect(within(rowFor('GitHub')).getByRole('button', { name: 'Remove' })).toBeDisabled()
    expect(within(rowFor('Google')).getByRole('button', { name: 'Connect Google' })).toBeInTheDocument()
  })

  it('posts the provider id with each form', () => {
    const { container } = render(<ConnectedAccountsSection linked={['github']} {...actions} />)
    const values = [...container.querySelectorAll('input[name="provider"]')].map((i) => (i as HTMLInputElement).value)
    expect(values.sort()).toEqual(['github', 'google'])
  })

  it('explains a link refused because the account belongs to someone else', () => {
    render(
      <ConnectedAccountsSection linked={['github']} status={{ linkError: 'OAuthAccountNotLinked' }} {...actions} />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/already connected to a different CVitae account/)
  })

  it('confirms a successful connection only when the provider really is linked', () => {
    const { rerender } = render(
      <ConnectedAccountsSection linked={['github', 'google']} status={{ linked: 'google' }} {...actions} />
    )
    expect(screen.getByRole('status')).toHaveTextContent('Google is now connected')
    rerender(<ConnectedAccountsSection linked={['github']} status={{ linked: 'google' }} {...actions} />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('explains why the last sign-in method was not removed', () => {
    render(
      <ConnectedAccountsSection linked={['github']} status={{ unlinkError: 'LAST_SIGN_IN_METHOD' }} {...actions} />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/only way to sign in/)
  })
})
