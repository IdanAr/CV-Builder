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

describe('Settings page', () => {
  beforeEach(() => {
    authMock.mockResolvedValue({ user: { id: 'u1', name: 'Jordan', email: 'j@example.com' } })
  })

  it('uses the shared page-title scale', async () => {
    const { default: SettingsPage } = await import('./page')
    render(await SettingsPage())
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toHaveAttribute(
      'class',
      'text-xl font-medium text-fg-heading',
    )
  })

  it('says "Not set" instead of a dash when name and email are missing', async () => {
    authMock.mockResolvedValue({ user: { id: 'u1' } })
    const { default: SettingsPage } = await import('./page')
    render(await SettingsPage())
    expect(screen.getAllByText('Not set')).toHaveLength(2)
  })
})
