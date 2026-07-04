// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { buildTextIndex, findAnchorIndex, resolveAnchorTops } from '@/lib/preview-anchor'
import { toMatchKey } from '@/lib/preview-pagination'

function makeRoot(html: string): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.appendChild(root)
  return root
}

describe('buildTextIndex', () => {
  it('concatenates match-key characters across nested elements', () => {
    const root = makeRoot('<div><strong>Data</strong>-Driven <em>Platform</em></div>')
    const index = buildTextIndex(root)
    expect(index.key).toBe('datadrivenplatform')
    expect(index.refs).toHaveLength(index.key.length)
  })

  it('maps every key character back to its text node and offset', () => {
    const root = makeRoot('<p>Ab</p><p>Cd</p>')
    const index = buildTextIndex(root)
    expect(index.key).toBe('abcd')
    expect(index.refs[2].node.data).toBe('Cd')
    expect(index.refs[2].offset).toBe(0)
  })

  it('skips whitespace, bullets, and hyphens', () => {
    const root = makeRoot('<li>• Cross-team   work</li>')
    const index = buildTextIndex(root)
    expect(index.key).toBe('crossteamwork')
  })
})

describe('findAnchorIndex', () => {
  const root = () =>
    makeRoot(
      '<p>Some earlier paragraph with plenty of words inside it.</p>' +
        '<p>Managed human resources within routine and emergency scenarios.</p>'
    )

  it('finds a full anchor', () => {
    const index = buildTextIndex(root())
    const key = toMatchKey('Managed human resources within routine')
    const at = findAnchorIndex(index, key, 0)
    expect(at).toBeGreaterThan(0)
    expect(index.key.slice(at, at + 7)).toBe('managed')
  })

  it('falls back to shorter prefixes when the tail differs', () => {
    const index = buildTextIndex(root())
    // Same first 40+ chars, then divergent tail (as if the PDF line continued differently)
    const key = toMatchKey('Managed human resources within routine and TOTALLY DIFFERENT TAIL CONTENT HERE')
    expect(findAnchorIndex(index, key, 0)).toBeGreaterThan(0)
  })

  it('drops a leading half-word when the full prefix misses', () => {
    const index = buildTextIndex(root())
    // First chars are a hyphenated remnant that is not in the DOM
    const key = 'xxxxxxxxxx' + toMatchKey('human resources within routine and emergency')
    expect(findAnchorIndex(index, key, 0)).toBeGreaterThan(0)
  })

  it('returns -1 when nothing matches', () => {
    const index = buildTextIndex(root())
    expect(findAnchorIndex(index, toMatchKey('completely absent content that matches nothing here'), 0)).toBe(-1)
  })

  it('respects fromIndex for sequential matching', () => {
    const index = buildTextIndex(makeRoot('<p>repeat me now</p><p>repeat me now</p>'))
    const key = toMatchKey('repeat me now')
    const first = findAnchorIndex(index, key, 0)
    const second = findAnchorIndex(index, key, first + 1)
    expect(second).toBeGreaterThan(first)
  })
})

describe('resolveAnchorTops', () => {
  function setup() {
    const wrapper = makeRoot('')
    const content = makeRoot(
      '<p>First page filler text that runs long enough to matter for everyone.</p>' +
        '<p>Second page starts with this exact sentence for anchor matching.</p>' +
        '<p>Third page starts with another distinct sentence entirely here.</p>'
    )
    return { wrapper, content }
  }

  it('uses measured positions when anchors match and pass the guards', () => {
    const { wrapper, content } = setup()
    const tops = new Map([['second', 900], ['third', 1850]])
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['second page starts with this exact sentence', 'third page starts with another distinct sentence'],
      estimateTopFor: (k) => (k + 1) * 1000,
      maxTop: 3000,
      measureTop: (ref) => {
        const text = ref.node.data.toLowerCase()
        if (text.includes('second page')) return tops.get('second')!
        if (text.includes('third page')) return tops.get('third')!
        return null
      },
    })
    expect(breaks).toEqual([
      { page: 1, top: 900, source: 'pdf' },
      { page: 2, top: 1850, source: 'pdf' },
    ])
  })

  it('falls back to the estimate when an anchor cannot be found', () => {
    const { wrapper, content } = setup()
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['this anchor text exists nowhere in the preview content'],
      estimateTopFor: () => 1234,
      maxTop: 3000,
      measureTop: () => null,
    })
    expect(breaks).toEqual([{ page: 1, top: 1234, source: 'estimate' }])
  })

  it('rejects non-monotonic measurements and falls back to the estimate', () => {
    const { wrapper, content } = setup()
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['second page starts with this exact sentence', 'third page starts with another distinct sentence'],
      estimateTopFor: (k) => (k + 1) * 1000,
      maxTop: 3000,
      // Second measurement is *above* the first — impossible in page flow
      measureTop: (ref) => (ref.node.data.toLowerCase().includes('second page') ? 900 : 800),
    })
    expect(breaks[0]).toEqual({ page: 1, top: 900, source: 'pdf' })
    expect(breaks[1]).toEqual({ page: 2, top: 2000, source: 'estimate' })
  })

  it('drops breaks that would land beyond the content', () => {
    const { wrapper, content } = setup()
    const breaks = resolveAnchorTops(wrapper, content, {
      anchors: ['nonexistent anchor text for this particular test case'],
      estimateTopFor: () => 5000,
      maxTop: 3000,
      measureTop: () => null,
    })
    expect(breaks).toEqual([])
  })
})
