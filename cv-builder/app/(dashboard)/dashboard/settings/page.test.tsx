// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

const authMock = vi.fn()
vi.mock('@/lib/auth', () => ({ auth: () => authMock() }))

vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('@/components/account/ExportDataSection', () => ({ ExportDataSection: () => <div /> }))
vi.mock('@/components/account/DeleteAccountSection', () => ({ DeleteAccountSection: () => <div /> }))

const listLinkedProvidersMock = vi.fn()
vi.mock('@/lib/api/account', () => ({ listLinkedProviders: (id: string) => listLinkedProvidersMock(id) }))
vi.mock('./actions', () => ({ connectProvider: vi.fn(), disconnectProvider: vi.fn() }))

const noParams = () => ({ searchParams: Promise.resolve({}) })

describe('Settings page', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: 'u1', name: 'Jordan', email: 'j@example.com' } })
    listLinkedProvidersMock.mockResolvedValue(['github'])
  })

  it('uses the shared page-title scale', async () => {
    const { default: SettingsPage } = await import('./page')
    render(await SettingsPage(noParams()))
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveAttribute(
      'class',
      'text-xl font-medium text-fg-heading',
    )
  })

  it('says "Not set" instead of a dash when name and email are missing', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    const { default: SettingsPage } = await import('./page')
    render(await SettingsPage(noParams()))
    expect(screen.getAllByText('Not set')).toHaveLength(2)
  })

  it('lists connected accounts for the signed-in user only', async () => {
    const { default: SettingsPage } = await import('./page')
    render(await SettingsPage(noParams()))
    expect(listLinkedProvidersMock).toHaveBeenCalledWith('u1')
    expect(screen.getByRole('heading', { name: 'Connected accounts' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Google' })).toBeInTheDocument()
  })
})
