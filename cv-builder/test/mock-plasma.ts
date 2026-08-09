// test/mock-plasma.ts
import { vi } from 'vitest'

// PlasmaBackground renders a real WebGL context via `ogl`, which jsdom doesn't
// support. Import this module (before importing the component under test) in
// any test that renders something wrapped in PlasmaBackground — see
// components/ui/Plasma.test.tsx for a more detailed mock used when a test
// needs to assert on the renderer's actual behavior (dpr, render call count,
// intersection triggers); this one is only for "let it mount without crashing".
vi.mock('ogl', () => {
  class FakeRenderer {
    gl = {
      canvas: document.createElement('canvas'),
      drawingBufferWidth: 100,
      drawingBufferHeight: 100,
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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * Call inside `beforeEach` in any test that renders PlasmaBackground.
 * Also touches ResizeObserver/IntersectionObserver/matchMedia (reads
 * prefers-reduced-motion) on mount — none of which jsdom provides.
 * Pair with `vi.unstubAllGlobals()` inside `afterEach`.
 */
export function mockPlasmaGlobals() {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub)
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}
