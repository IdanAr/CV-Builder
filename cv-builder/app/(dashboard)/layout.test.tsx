// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Loading the WebGL background in an authenticated route is the regression
// this guards: the mock throws if anything imports it.
vi.mock('@/components/ui/PlasmaBackground', () => {
  throw new Error('PlasmaBackground must not be used on authenticated routes')
})

import DashboardLayout from './layout'

describe('(dashboard) layout', () => {
  it('renders children inside the skip-link target on a flat page', () => {
    render(
      <DashboardLayout>
        <p>content</p>
      </DashboardLayout>
    )
    const main = document.getElementById('main-content')
    expect(main).not.toBeNull()
    expect(screen.getByText('content')).toBeInTheDocument()
    expect(main!.parentElement!.className).toContain('bg-surface-page')
  })
})
