// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ListFieldManager } from './ListFieldManager'

interface Item {
  id: string
  value: string
}

const renderCounts: Record<string, number> = {}

function ItemForm({ item, onUpdate }: { item: Item; onUpdate: (v: Item) => void }) {
  // Counted in an effect (post-commit), not during render — mutating
  // module-level state during render is disallowed by this project's lint
  // rules (React Compiler purity), and an effect with no deps still fires
  // once per render/commit, which is exactly what this test needs to count.
  useEffect(() => {
    renderCounts[item.id] = (renderCounts[item.id] ?? 0) + 1
  })
  return (
    <input
      aria-label={`item-${item.id}`}
      value={item.value}
      onChange={(e) => onUpdate({ ...item, value: e.target.value })}
    />
  )
}

function Harness() {
  const [items, setItems] = useState<Item[]>([
    { id: 'a', value: '' },
    { id: 'b', value: '' },
    { id: 'c', value: '' },
  ])
  return (
    <ListFieldManager<Item>
      items={items}
      onChange={setItems}
      createEmpty={() => ({ id: 'new', value: '' })}
      renderItem={(item, _, onUpdate) => <ItemForm item={item} onUpdate={onUpdate} />}
    />
  )
}

describe('ListFieldManager — sibling isolation', () => {
  it('only re-renders the edited item, not its siblings', () => {
    for (const k of Object.keys(renderCounts)) delete renderCounts[k]
    render(<Harness />)

    expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 })

    fireEvent.change(screen.getByLabelText('item-b'), { target: { value: 'x' } })

    expect(renderCounts.b).toBe(2)
    expect(renderCounts.a).toBe(1)
    expect(renderCounts.c).toBe(1)
  })
})
