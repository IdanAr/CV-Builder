// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { mockPlasmaGlobals } from '@/test/mock-plasma'
import { PlasmaBackground } from './PlasmaBackground'

beforeEach(() => {
  mockPlasmaGlobals()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PlasmaBackground', () => {
  it('renders children immediately, without waiting on the Plasma canvas to load', () => {
    render(
      <PlasmaBackground>
        <p>dashboard content</p>
      </PlasmaBackground>
    )
    expect(screen.getByText('dashboard content')).toBeInTheDocument()
  })

  it('mounts the Plasma WebGL canvas asynchronously, without crashing', async () => {
    const { container } = render(
      <PlasmaBackground>
        <p>dashboard content</p>
      </PlasmaBackground>
    )
    await waitFor(() => {
      expect(container.querySelector('canvas')).toBeInTheDocument()
    })
  })
})
