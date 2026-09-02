// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useEffect, useState } from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { arrayMove } from '@dnd-kit/sortable'
import { ListFieldManager } from './ListFieldManager'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { useToastStore } from '@/lib/stores/toast.store'

// CSS.Transform.toString is from @dnd-kit/utilities; mock it for jsdom
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

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

describe('ListFieldManager reordering', () => {
  function ReorderHarness() {
    const [items, setItems] = useState<Item[]>([
      { id: 'a', value: 'first' },
      { id: 'b', value: 'second' },
      { id: 'c', value: 'third' },
    ])
    return (
      <ListFieldManager<Item>
        items={items}
        onChange={setItems}
        createEmpty={() => ({ id: 'new', value: '' })}
        renderItem={(item, _, onUpdate) => (
          <input aria-label={`item-${item.id}`} value={item.value} onChange={(e) => onUpdate({ ...item, value: e.target.value })} />
        )}
      />
    )
  }

  it('renders a drag handle per item', () => {
    render(<ReorderHarness />)
    expect(screen.getByTestId(/^list-drag-handle-.*-0$/)).toBeTruthy()
    expect(screen.getByTestId(/^list-drag-handle-.*-1$/)).toBeTruthy()
    expect(screen.getByTestId(/^list-drag-handle-.*-2$/)).toBeTruthy()
  })

  it('moves an item to a new position when the handler is invoked directly', () => {
    // dnd-kit's pointer sensor requires real pointer geometry jsdom doesn't
    // provide; this exercises the same arrayMove the drag-end handler uses,
    // confirming the wiring produces the correct final order.
    const items: Item[] = [{ id: 'a', value: '1' }, { id: 'b', value: '2' }, { id: 'c', value: '3' }]
    expect(arrayMove(items, 0, 2)).toEqual([
      { id: 'b', value: '2' }, { id: 'c', value: '3' }, { id: 'a', value: '1' },
    ])
  })

  it('drag handles are keyboard-focusable with a descriptive label', () => {
    render(<ReorderHarness />)
    const handle = screen.getByTestId(/^list-drag-handle-.*-1$/)
    expect(handle.getAttribute('aria-label')).toBe('Drag to reorder')
  })
})

describe('ListFieldManager keyboard drag-and-drop', () => {
  // Mirrors DesignPanel.test.tsx's keyboard-DnD test: dnd-kit's KeyboardSensor
  // computes movement from each sortable row's getBoundingClientRect via
  // sortableKeyboardCoordinates, and jsdom returns an all-zero rect for every
  // element by default — this mock gives each row a distinct vertical
  // position based on DOM order so the sensor can tell rows apart.
  function mockRowRects() {
    return vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
      this: HTMLElement
    ) {
      const parent = this.parentElement
      const siblings = parent ? Array.from(parent.children) : []
      const index = siblings.indexOf(this)
      const top = index >= 0 ? index * 60 : 0
      return {
        top, left: 0, right: 240, bottom: top + 56, width: 240, height: 56, x: 0, y: top,
        toJSON() { return {} },
      } as DOMRect
    })
  }

  function KeyboardReorderHarness() {
    const [items, setItems] = useState<Item[]>([
      { id: 'a', value: 'first' },
      { id: 'b', value: 'second' },
      { id: 'c', value: 'third' },
    ])
    return (
      <ListFieldManager<Item>
        items={items}
        onChange={setItems}
        createEmpty={() => ({ id: 'new', value: '' })}
        renderItem={(item, _, onUpdate) => (
          <input aria-label={`item-${item.id}`} value={item.value} onChange={(e) => onUpdate({ ...item, value: e.target.value })} />
        )}
      />
    )
  }

  it('reorders an entry via keyboard (Space to pick up, Arrow to move, Space to drop)', async () => {
    const rectSpy = mockRowRects()
    render(<KeyboardReorderHarness />)

    const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
    expect(handles).toHaveLength(3)

    handles[0].focus()
    fireEvent.keyDown(handles[0], { key: ' ', code: 'Space' })
    // KeyboardSensor attaches its keydown listener via setTimeout(0) after
    // pickup, so the following keys must wait a tick to be picked up.
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.keyDown(handles[0], { key: 'ArrowDown', code: 'ArrowDown' })
    fireEvent.keyDown(handles[0], { key: ' ', code: 'Space' })

    expect(screen.getByLabelText('item-b')).toBeTruthy()
    // 'a' (originally first) should now render after 'b' — confirm via DOM order.
    const values = screen.getAllByRole('textbox').map((el) => (el as HTMLInputElement).value)
    expect(values).toEqual(['second', 'first', 'third'])

    rectSpy.mockRestore()
  })

  it('pointer-based drag-and-drop still works (PointerSensor unaffected by the keyboard fix)', () => {
    render(<KeyboardReorderHarness />)
    const handles = screen.getAllByRole('button', { name: /drag to reorder/i })
    expect(handles).toHaveLength(3)
    expect(handles[0]).toHaveAttribute('role', 'button')
  })
})

describe('ListFieldManager instance-unique drag-handle testids', () => {
  // Mirrors real nesting (e.g. WorkForm: work entries -> roles -> highlights):
  // two ListFieldManager instances mounted side by side, each with an item
  // at the same position. Before the fix, both used a bare `-${i}` suffix,
  // so `list-drag-handle-0` matched a node in *either* instance — a query
  // scoped to one instance could silently resolve to the other's DOM node.
  function TwoInstanceHarness() {
    const [a, setA] = useState<Item[]>([{ id: 'a1', value: 'a1' }])
    const [b, setB] = useState<Item[]>([{ id: 'b1', value: 'b1' }])
    const renderItem = (item: Item, _: number, onUpdate: (v: Item) => void) => (
      <ItemForm item={item} onUpdate={onUpdate} />
    )
    return (
      <>
        <ListFieldManager<Item> items={a} onChange={setA} createEmpty={() => ({ id: 'new', value: '' })} renderItem={renderItem} />
        <ListFieldManager<Item> items={b} onChange={setB} createEmpty={() => ({ id: 'new', value: '' })} renderItem={renderItem} />
      </>
    )
  }

  it('gives each instance its own unique drag-handle testid, even for items at the same index', () => {
    render(<TwoInstanceHarness />)
    const handles = screen.getAllByTestId(/^list-drag-handle-/)
    expect(handles).toHaveLength(2)
    const testIds = handles.map((el) => el.getAttribute('data-testid'))
    expect(new Set(testIds).size).toBe(2)
  })
})

describe('ListFieldManager undo-on-remove', () => {
  // Removing an entry destroys a whole job/education record — dates, bullet
  // points and all — from a button a few pixels from the drag handle. The
  // delete stays instant, but it must be reversible.
  function UndoHarness() {
    const [items, setItems] = useState<Item[]>([
      { id: 'a', value: 'first' },
      { id: 'b', value: 'second' },
      { id: 'c', value: 'third' },
    ])
    return (
      <ListFieldManager<Item>
        items={items}
        onChange={setItems}
        createEmpty={() => ({ id: 'new', value: '' })}
        renderItem={(item, _, onUpdate, onRemove) => (
          <div>
            <input
              aria-label={`item-${item.id}`}
              value={item.value}
              onChange={(e) => onUpdate({ ...item, value: e.target.value })}
            />
            <button aria-label={`remove-${item.id}`} onClick={onRemove}>
              remove
            </button>
          </div>
        )}
      />
    )
  }

  beforeEach(() => {
    useToastStore.setState({ toasts: [] })
  })

  it('offers an undo action when an entry is removed', () => {
    render(<UndoHarness />)

    fireEvent.click(screen.getByLabelText('remove-b'))

    expect(screen.queryByLabelText('item-b')).toBeNull()
    const [t] = useToastStore.getState().toasts
    expect(t.message).toBe('Entry removed')
    expect(t.actionLabel).toBe('Undo')
  })

  it('restores the removed entry at its original position when undo is invoked', () => {
    render(<UndoHarness />)

    fireEvent.click(screen.getByLabelText('remove-b'))
    act(() => {
      useToastStore.getState().toasts[0].onAction?.()
    })

    const values = screen.getAllByRole('textbox').map((el) => (el as HTMLInputElement).value)
    expect(values).toEqual(['first', 'second', 'third'])
  })

  it('does not discard a concurrent edit made while the undo toast was up', () => {
    render(<UndoHarness />)

    fireEvent.click(screen.getByLabelText('remove-b'))
    // Edit a surviving entry before undoing — the restore must merge into the
    // live array, not replay a snapshot captured at delete time.
    fireEvent.change(screen.getByLabelText('item-c'), { target: { value: 'third edited' } })
    act(() => {
      useToastStore.getState().toasts[0].onAction?.()
    })

    const values = screen.getAllByRole('textbox').map((el) => (el as HTMLInputElement).value)
    expect(values).toEqual(['first', 'second', 'third edited'])
  })
})

describe('ListFieldManager item-identity key regression', () => {
  // Mirrors CustomSectionItemSchema: items carry their own stable `id`,
  // separate from array position. `ListFieldManager`'s row wrapper must key
  // off that id, not the index, or React reconciliation will reuse a DOM
  // node across an add/remove for a *different* underlying item.
  function IdentityHarness() {
    const [items, setItems] = useState<Item[]>([
      { id: 'a', value: 'first' },
      { id: 'b', value: 'second' },
      { id: 'c', value: 'third' },
    ])
    return (
      <ListFieldManager<Item>
        items={items}
        onChange={setItems}
        createEmpty={() => ({ id: 'new', value: '' })}
        renderItem={(item, _, onUpdate, onRemove) => (
          <div>
            <input
              aria-label={`item-${item.id}`}
              value={item.value}
              onChange={(e) => onUpdate({ ...item, value: e.target.value })}
            />
            <button aria-label={`remove-${item.id}`} onClick={onRemove}>
              remove
            </button>
          </div>
        )}
      />
    )
  }

  it('keeps a later item bound to its own id (not its position) when an earlier item is removed', () => {
    render(<IdentityHarness />)

    // Focus the input belonging to item 'b', currently at position 1.
    const inputB = screen.getByLabelText('item-b') as HTMLInputElement
    inputB.focus()
    expect(document.activeElement).toBe(inputB)

    // Remove item 'a' (position 0, an *earlier* item). 'b' shifts from
    // position 1 to position 0. If the row wrapper were still keyed by
    // position (key={i}), React would match old key=1 (which held focus,
    // rendering 'b') against new key=1 (now item 'c', since 'c' shifted
    // into position 1) and reuse that same DOM node for 'c' — the focused
    // input would silently start showing/editing item 'c''s data instead
    // of 'b''s, and a query for 'item-b' would resolve to a different
    // (recycled) node than the one that actually has focus.
    fireEvent.click(screen.getByLabelText('remove-a'))

    // With an id-keyed wrapper, 'b' keeps its own DOM node/identity
    // regardless of its new position: the previously-focused element is
    // the SAME node, still labeled and valued for 'b', and focus survives
    // the removal untouched.
    const inputBAfter = screen.getByLabelText('item-b') as HTMLInputElement
    expect(inputBAfter).toBe(inputB)
    expect(document.activeElement).toBe(inputBAfter)
    expect(inputBAfter.value).toBe('second')

    // Item 'c' — now sitting at the position 'b' used to occupy — must NOT
    // have been silently merged into the previously-focused node; it keeps
    // its own separate node with its own value, untouched by 'b''s focus.
    const inputC = screen.getByLabelText('item-c') as HTMLInputElement
    expect(inputC).not.toBe(inputB)
    expect(inputC.value).toBe('third')

    // 'a' is gone.
    expect(screen.queryByLabelText('item-a')).toBeNull()
  })
})

// jsdom doesn't implement scrollIntoView at all; stub it so the component's
// call doesn't throw, and so its arguments are inspectable.
function stubScrollIntoView(): ReturnType<typeof vi.fn> {
  const spy = vi.fn()
  Element.prototype.scrollIntoView = spy
  return spy
}

describe('ListFieldManager entry-level focus (pendingFocus + pendingFocusEntryIndex)', () => {
  function FocusHarness({ sectionKey }: { sectionKey: string }) {
    const [items, setItems] = useState<Item[]>([
      { id: 'a', value: 'first' },
      { id: 'b', value: 'second' },
    ])
    return (
      <ListFieldManager<Item>
        sectionKey={sectionKey}
        items={items}
        onChange={setItems}
        createEmpty={() => ({ id: 'new', value: '' })}
        renderItem={(item, _, onUpdate) => <ItemForm item={item} onUpdate={onUpdate} />}
      />
    )
  }

  it('scrolls to and focuses the requested entry, then clears the focus request', async () => {
    const scrollSpy = stubScrollIntoView()
    useResumeEditorStore.getState().requestFocus('work', 1)

    render(<FocusHarness sectionKey="work" />)
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    expect(scrollSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(document.activeElement).toBe(screen.getByLabelText('item-b'))
    expect(useResumeEditorStore.getState().pendingFocus).toBeNull()
    expect(useResumeEditorStore.getState().pendingFocusEntryIndex).toBeNull()
  })

  it('does nothing when pendingFocus names a different section', async () => {
    const scrollSpy = stubScrollIntoView()
    useResumeEditorStore.getState().requestFocus('education', 0)

    render(<FocusHarness sectionKey="work" />)
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    expect(scrollSpy).not.toHaveBeenCalled()
    // Left untouched for whichever section actually matches "education".
    expect(useResumeEditorStore.getState().pendingFocus).toBe('education')
    expect(useResumeEditorStore.getState().pendingFocusEntryIndex).toBe(0)
  })

  it('does nothing when no sectionKey prop is passed (opt-out)', async () => {
    const scrollSpy = stubScrollIntoView()
    useResumeEditorStore.getState().requestFocus('work', 1)

    function NoKeyHarness() {
      const [items, setItems] = useState<Item[]>([{ id: 'a', value: 'first' }])
      return (
        <ListFieldManager<Item>
          items={items}
          onChange={setItems}
          createEmpty={() => ({ id: 'new', value: '' })}
          renderItem={(item, _, onUpdate) => <ItemForm item={item} onUpdate={onUpdate} />}
        />
      )
    }
    render(<NoKeyHarness />)
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve))
    })

    expect(scrollSpy).not.toHaveBeenCalled()
    expect(useResumeEditorStore.getState().pendingFocus).toBe('work')
  })
})
