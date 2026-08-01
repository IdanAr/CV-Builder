// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Renderer } from 'ogl'
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

interface FakeRendererInstance {
  dpr: number
  renderCallCount: number
}

vi.mock('ogl', () => {
  class FakeRenderer {
    static instances: FakeRenderer[] = []
    gl: {
      canvas: HTMLCanvasElement
      drawingBufferWidth: number
      drawingBufferHeight: number
    }
    dpr: number
    renderCallCount = 0
    constructor(opts: { dpr: number }) {
      this.dpr = opts.dpr
      this.gl = {
        canvas: document.createElement('canvas'),
        drawingBufferWidth: 100,
        drawingBufferHeight: 100,
      }
      FakeRenderer.instances.push(this)
    }
    setSize() {}
    render() {
      this.renderCallCount++
    }
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

function lastRendererInstance(): FakeRendererInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const instances = (Renderer as any).instances as FakeRendererInstance[]
  return instances[instances.length - 1]
}

describe('Plasma — animation lifecycle', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>
  let cafSpy: ReturnType<typeof vi.spyOn>
  let pendingFrame: FrameRequestCallback | null

  function fireFrame(t: number) {
    const cb = pendingFrame
    pendingFrame = null
    cb?.(t)
  }

  beforeEach(() => {
    IntersectionObserverStub.instances = []
    pendingFrame = null
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      pendingFrame = cb
      return 1
    })
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

  it('caps the WebGL renderer DPR at 1 regardless of devicePixelRatio', () => {
    vi.stubGlobal('devicePixelRatio', 3)
    render(<Plasma />)
    expect(lastRendererInstance().dpr).toBe(1)
  })

  it('throttles GPU render calls to ~30fps regardless of rAF frequency — the loop stays visible/focused the whole time, matching normal active use', () => {
    render(<Plasma />)
    const renderer = lastRendererInstance()

    fireFrame(1000)
    expect(renderer.renderCallCount).toBe(1)

    fireFrame(1010) // 10ms later — under the ~33ms budget, should skip
    expect(renderer.renderCallCount).toBe(1)

    fireFrame(1040) // 40ms after the first render — over budget, should render
    expect(renderer.renderCallCount).toBe(2)
  })
})
