// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Plasma } from './Plasma'

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

type IntersectionCallback = (entries: Array<{ isIntersecting: boolean }>) => void

class IntersectionObserverStub {
  static instances: IntersectionObserverStub[] = []
  callback: IntersectionCallback
  constructor(callback: IntersectionCallback) {
    this.callback = callback
    IntersectionObserverStub.instances.push(this)
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(isIntersecting: boolean) {
    this.callback([{ isIntersecting }])
  }
}

vi.mock('ogl', () => {
  class FakeRenderer {
    gl: {
      canvas: HTMLCanvasElement
      drawingBufferWidth: number
      drawingBufferHeight: number
    }
    constructor() {
      this.gl = {
        canvas: document.createElement('canvas'),
        drawingBufferWidth: 100,
        drawingBufferHeight: 100,
      }
    }
    setSize() {}
    render() {}
  }
  class FakeProgram {
    uniforms: Record<string, { value: unknown }>
    constructor(_gl: unknown, opts: { uniforms: Record<string, { value: unknown }> }) {
      this.uniforms = opts.uniforms
    }
  }
  class FakeMesh {}
  class FakeTriangle {}
  return { Renderer: FakeRenderer, Program: FakeProgram, Mesh: FakeMesh, Triangle: FakeTriangle }
})

describe('Plasma — animation lifecycle', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>
  let cafSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    IntersectionObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1)
    cafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('starts the rAF loop once mounted and intersecting', () => {
    render(<Plasma />)
    expect(rafSpy).toHaveBeenCalled()
  })

  it('stops scheduling frames when scrolled off-screen', () => {
    render(<Plasma />)
    const io = IntersectionObserverStub.instances[0]
    rafSpy.mockClear()

    io.trigger(false)
    expect(cafSpy).toHaveBeenCalled()

    rafSpy.mockClear()
    io.trigger(false)
    expect(rafSpy).not.toHaveBeenCalled()
  })

  it('resumes scheduling frames when scrolled back into view', () => {
    render(<Plasma />)
    const io = IntersectionObserverStub.instances[0]

    io.trigger(false)
    rafSpy.mockClear()

    io.trigger(true)
    expect(rafSpy).toHaveBeenCalled()
  })

  it('does not start the animation loop when prefers-reduced-motion is set', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    rafSpy.mockClear()

    render(<Plasma />)
    expect(rafSpy).not.toHaveBeenCalled()
  })

  it('stops the loop and disconnects observers on unmount', () => {
    const { unmount } = render(<Plasma />)
    rafSpy.mockClear()
    unmount()
    expect(cafSpy).toHaveBeenCalled()
  })
})
