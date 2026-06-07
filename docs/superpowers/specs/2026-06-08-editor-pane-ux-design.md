# Editor Pane UX — Design Spec
**Date:** 2026-06-08  
**Status:** Approved

## Summary

Three UX improvements to the CV Builder editor shell:

1. **Resizable pane** — drag the divider between editor and preview to set any width
2. **Sticky Undo/Redo** — pin the buttons above the scrollable section list so they never disappear
3. **Drag & drop section ordering** — replace ↑↓ buttons with a drag handle; fix preview not reflecting reordering

---

## Dependency

Add `@dnd-kit/core` and `@dnd-kit/sortable` for drag & drop.

---

## 1. Resizable Pane

### Behaviour
- The left editor panel has a draggable right edge.
- Min width: **240px**. Max width: **60% of `window.innerWidth`**.
- Default width: **320px** (current hardcoded value).
- Last width persisted to `localStorage` under key `cv-builder:panel-width` and restored on mount.

### Implementation — `EditorShell.tsx`
- Replace `w-80 min-w-[320px]` with inline `style={{ width: panelWidth }}` where `panelWidth` is a `useState<number>`.
- On mount, read `localStorage.getItem('cv-builder:panel-width')` and set state if valid.
- Insert a `4px wide` `shrink-0` divider `div` between the left panel and the right preview panel.
  - `cursor: col-resize`
  - Background: transparent at rest; transitions to `bg-indigo-400/40` on hover and while dragging.
- On `pointerdown` on the divider: call `e.currentTarget.setPointerCapture(e.pointerId)` so fast mouse moves don't lose the drag.
- On `pointermove`: `newWidth = e.clientX - leftPanelRef.current.getBoundingClientRect().left`, clamped to [240, window.innerWidth * 0.6], set `panelWidth`.
- On `pointerup`: release capture, write final width to `localStorage`.

### What doesn't change
- The existing "expand preview" button (`⛶`) is kept as-is for now.

---

## 2. Sticky Undo/Redo Strip

### Behaviour
- The Undo and Redo buttons are always visible while the Edit tab is open, regardless of scroll position.

### Implementation — `EditorShell.tsx`
- Subscribe to `undo`, `redo`, `canUndo`, `canRedo` from the store directly inside `EditorShell`.
- Restructure the left panel's flex column:
  1. Title bar (`shrink-0`)
  2. Tab bar (`shrink-0`)
  3. **Undo/Redo strip** (`shrink-0`, only rendered when `activeTab === 'edit'`)
  4. Scrollable tab content (`flex-1 overflow-auto`)
- The strip uses the same button styling as today (`border border-indigo-200 text-indigo-600 rounded px-2 py-1 text-xs`), with `disabled:opacity-40 disabled:cursor-not-allowed`.

### Implementation — `EditTab.tsx`
- Remove the 4 store selectors (`undo`, `redo`, `canUndo`, `canRedo`) and the button JSX.
- Keep the `useEffect` keyboard shortcut handler (Ctrl+Z / Ctrl+Y) — it is editing-context-specific and belongs in `EditTab`.

---

## 3. Drag & Drop Section Ordering + Preview Fix

### Drag & drop behaviour
- Every section except **Personal Info (basics)** is draggable.
- `basics` is always pinned first and rendered outside the sortable context.
- Drag handle: a `⠿` braille dots icon on the left side of each section row.
  - Hidden at rest (`opacity-0`), revealed on row hover (`group-hover:opacity-100`).
  - Cursor changes to `grab` on the handle.
- While dragging: the active item shows a dashed indigo border and reduced opacity (~60%).
- On drop: `meta.sectionOrder` is updated via `setMeta`, which also pushes an undo history entry. Preview updates after the 300ms debounce.
- Custom sections (prefix `custom:`) participate in drag & drop the same as standard sections.

### Implementation — `EditTab.tsx`
- Install: `@dnd-kit/core`, `@dnd-kit/sortable`.
- Wrap non-basics section list in:
  ```tsx
  <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
    <SortableContext items={orderedSections} strategy={verticalListSortingStrategy}>
      {/* sortable items */}
    </SortableContext>
  </DndContext>
  ```
- Each sortable row is a small `SortableAccordionItem` local component (defined at the bottom of `EditTab.tsx`, not a new file) that calls `useSortable({ id: section })` and passes `listeners`, `attributes`, `setNodeRef`, `transform`, `transition`, `isDragging` to `AccordionSection` via a `dragHandleProps` prop.
- `handleDragEnd({ active, over })`:
  ```ts
  if (!over || active.id === over.id) return
  const oldIndex = orderedSections.indexOf(active.id as string)
  const newIndex = orderedSections.indexOf(over.id as string)
  setMeta({ sectionOrder: arrayMove(orderedSections, oldIndex, newIndex) })
  ```

### Implementation — `AccordionSection.tsx`
- Remove `onMoveUp?: () => void` and `onMoveDown?: () => void` props entirely.
- Add:
  ```ts
  dragHandleProps?: {
    listeners: SyntheticListenerMap | undefined
    attributes: DraggableAttributes
    setNodeRef: (el: HTMLElement | null) => void
    transform: Transform | null
    transition: string | undefined
    isDragging: boolean
  }
  ```
- When `dragHandleProps` is present:
  - Apply `ref`, `transform` (via `CSS.Transform.toString`), `transition`, and `isDragging` styles to the root `div`.
  - Render a `⠿` grip button on the left, receiving `listeners` and `attributes`. The grip has `opacity-0 group-hover:opacity-100 transition-opacity cursor-grab`.
  - The root `div` gets `group` class to enable the hover-reveal.
- When `dragHandleProps` is absent (only `basics` today): render exactly as before.

### Preview fix — `ClassicTemplate.tsx`, `ModernTemplate.tsx`, `MinimalTemplate.tsx`
Change:
```tsx
{sectionOrder.map(renderSection)}
```
To:
```tsx
{sectionOrder.map((s) => (
  <React.Fragment key={s}>{renderSection(s)}</React.Fragment>
))}
```
This pins the React reconciliation key to the section string at the `.map()` level, making reordering reliably reflect in the preview.

---

## Files Changed

| File | Change type |
|---|---|
| `components/editor/EditorShell.tsx` | Resize logic + Undo/Redo strip |
| `components/editor/EditTab.tsx` | dnd-kit context + remove Undo/Redo + remove move buttons |
| `components/editor/AccordionSection.tsx` | Add `dragHandleProps`, remove `onMoveUp`/`onMoveDown` |
| `components/templates/ClassicTemplate.tsx` | Fragment key fix |
| `components/templates/ModernTemplate.tsx` | Fragment key fix |
| `components/templates/MinimalTemplate.tsx` | Fragment key fix |
| `package.json` | Add `@dnd-kit/core`, `@dnd-kit/sortable` |
| `components/editor/AccordionSection.test.tsx` | Remove tests for `onMoveUp`/`onMoveDown`; add tests for `dragHandleProps` |
| `components/editor/EditTab.test.tsx` | Update tests that assert Undo/Redo buttons are rendered in `EditTab` |

---

## Out of Scope

- Touch drag support (dnd-kit handles it, but not explicitly tested)
- Keyboard reordering via arrow keys (dnd-kit supports it via `KeyboardSensor`; can be added later)
- Replacing the existing "expand preview" button with the resize handle as primary affordance
