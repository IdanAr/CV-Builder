# Editor Layout Redesign Spec
**Date:** 2026-06-04
**Status:** Approved

## Goal

Replace the current full-screen tab switcher (Edit / Preview / Design / ATS) with a persistent split-panel layout where Edit controls and the live preview are always visible side by side. Section reordering moves from DesignPanel into the EditTab accordion headers.

---

## Layout: Split-Panel with Collapsible Left Panel

### Normal state

```
┌─────────────────────────────────────────────────────────────────┐
│ [Title input ................] [● Unsaved]     ← left header    │
├──────────────────────────┬──────────────────────────────────────┤
│ Edit │ Design │ ATS      │  Live Preview  JSON PDF DOCX  ⛶     │
├──────────────────────────┼──────────────────────────────────────┤
│                          │                                      │
│  ▾ Work Experience  ↑ ↓  │        [resume canvas]              │
│  ▸ Education        ↑ ↓  │                                      │
│  ▸ Skills           ↑ ↓  │                                      │
│  ▸ Certifications   ↑ ↓  │                                      │
│                          │                                      │
│  (Design tab content)    │                                      │
│  (ATS tab content)       │                                      │
│                          │                                      │
└──────────────────────────┴──────────────────────────────────────┘
  fixed 320px                flex-1
```

### Expanded preview state (after ⛶ click)

```
┌────┬────────────────────────────────────────────────────────────┐
│Edit│  Live Preview  JSON PDF DOCX  ⛶ (active/blue)             │
│    ├────────────────────────────────────────────────────────────┤
│Dsgn│                                                            │
│    │              [resume canvas — full width]                  │
│ATS │                                                            │
└────┴────────────────────────────────────────────────────────────┘
 36px  flex-1
```

Left panel collapses to a 36px dark sidebar with rotated tab labels (still clickable to restore the split). The ⛶ button turns blue to indicate expanded state. Clicking ⛶ again restores the split.

---

## State

`EditorShell` gains one new piece of local state:

```ts
const [previewExpanded, setPreviewExpanded] = useState(false)
```

Left panel width is driven by `previewExpanded`:
- `false` → `w-80` (320px), content visible
- `true` → `w-9` (36px), dark background, rotated tab labels only

---

## Components Changed

### 1. `EditorShell.tsx` — full restructure

**Remove:**
- `activeTab` state's `'preview'` case (preview is now always visible)
- The old tab bar spanning the full width
- The `hidden` / `flex` class toggling for tab panels
- Export buttons from the top header

**Add:**
- Two-panel flex layout: left panel (fixed width) + right panel (flex-1)
- Left panel: title + save status header, then Edit/Design/ATS tab bar, then scrollable tab content area
- Right panel: header row with "Live Preview" label + JSON/PDF/DOCX export buttons + ⛶ toggle button, then `<ResumePreviewPanel />` below
- `previewExpanded` state controlling left panel width
- Collapsed sidebar: dark background (`bg-slate-800`), rotated tab labels, clicking any label sets `previewExpanded = false` and switches to that tab

**Left panel header** (title + save, no export buttons):
```tsx
<div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 shrink-0">
  <input value={storeTitle} onChange={...} className="..." />
  <span className="text-xs text-gray-400 shrink-0">{saveStatus}</span>
</div>
```

**Right panel header** (exports + expand):
```tsx
<div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white shrink-0">
  <span className="text-xs font-medium text-gray-500 flex-1">Live Preview</span>
  <button onClick={handleJsonExport}>JSON</button>
  <button onClick={() => handleExport('pdf')}>PDF</button>
  <button onClick={() => handleExport('docx')}>DOCX</button>
  <div className="w-px h-4 bg-gray-200" />
  <button onClick={() => setPreviewExpanded(v => !v)}
    className={previewExpanded ? 'text-blue-600 border-blue-300 bg-blue-50' : '...'}>
    ⛶
  </button>
</div>
```

### 2. `PreviewTab.tsx` — simplify (no rename)

Remove the zoom control sub-header (75% / 100% / Fit buttons). In the split layout the panel is always narrower than full-screen, so always-fit is the right default. The component becomes a pure canvas — keep the filename and export name unchanged:

```tsx
export function PreviewTab() {
  // debounced data/meta from store (unchanged)
  // fitScale calculated from containerRef (unchanged)
  // always renders at fitScale — no zoom state, no zoom sub-header
  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-gray-100 flex justify-center py-8">
      <div style={{ transform: `scale(${fitScale})`, transformOrigin: 'top center' }}>
        <Template data={debouncedData} meta={debouncedMeta} />
      </div>
    </div>
  )
}
```

### 3. `AccordionSection.tsx` — add optional reorder props

Add two optional callbacks:

```ts
interface AccordionSectionProps {
  title: string
  badge?: string
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
  onMoveUp?: () => void    // new — omit for sections that can't move up
  onMoveDown?: () => void  // new — omit for sections that can't move down
}
```

When `onMoveUp` or `onMoveDown` is provided, render the respective ↑ / ↓ button in the accordion header (between badge and chevron). When omitted (undefined), the button is not rendered.

```tsx
<button
  type="button"
  onClick={onToggle}
  className="w-full flex items-center justify-between px-4 py-3 ..."
>
  <span className="font-medium text-sm text-gray-800">{title}</span>
  <div className="flex items-center gap-1">
    {badge && <span className="...">{badge}</span>}
    {onMoveUp && (
      <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp() }}
        className="p-1 text-gray-400 hover:text-gray-600" aria-label={`Move ${title} up`}>
        ↑
      </button>
    )}
    {onMoveDown && (
      <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown() }}
        className="p-1 text-gray-400 hover:text-gray-600" aria-label={`Move ${title} down`}>
        ↓
      </button>
    )}
    <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
  </div>
</button>
```

**Important:** `e.stopPropagation()` on the ↑↓ button clicks prevents the accordion from toggling when reordering.

### 4. `EditTab.tsx` — wire reorder callbacks

`basics` is always first and pinned — never gets ↑↓ buttons.

For all sections in `meta.sectionOrder`, pass `onMoveUp` / `onMoveDown` based on index:

```ts
const setMeta = useResumeEditorStore((s) => s.setMeta)

function moveSection(index: number, direction: 'up' | 'down') {
  const order = [...meta.sectionOrder]
  const swapIdx = direction === 'up' ? index - 1 : index + 1
  ;[order[index], order[swapIdx]] = [order[swapIdx], order[index]]
  setMeta({ sectionOrder: order })
}
```

When rendering sections:
- `basics` → no `onMoveUp`, no `onMoveDown`
- First section in `meta.sectionOrder` (index 0) → no `onMoveUp`, has `onMoveDown`
- Last section → has `onMoveUp`, no `onMoveDown`
- Middle sections → both callbacks provided

### 5. `DesignPanel.tsx` — remove SectionOrderEditor

Remove the entire "Section Order" block added in Phase 4 (the `SECTION_LABELS` map, `moveSection` helper, and the Section Order UI). The DesignPanel reverts to template / layout / font / color / margin / line-spacing controls only.

Update `DesignPanel.test.tsx`: remove the 5 SectionOrderEditor tests (they move to `EditTab.test.tsx`).

---

## Tests

### `AccordionSection.test.tsx` — add 4 tests
1. Does not render ↑↓ buttons when callbacks are omitted
2. Renders ↑ button when `onMoveUp` provided, ↓ when `onMoveDown` provided
3. Clicking ↑ calls `onMoveUp` (not `onToggle`)
4. Clicking ↓ calls `onMoveDown` (not `onToggle`)

### `EditTab.test.tsx` — new file, 4 tests
1. Renders sections in `meta.sectionOrder` order
2. `basics` section has no ↑↓ buttons
3. First orderable section has ↓ but no ↑
4. Clicking ↓ on a section calls `setMeta` with the correct swapped `sectionOrder`

### `DesignPanel.test.tsx` — remove 5 SectionOrderEditor tests

---

## What Does NOT Change

- Zustand store interface — `setMeta`, `meta.sectionOrder` unchanged
- PDF / DOCX export routes and logic
- ATS scoring panel (just moves to a left-panel tab instead of full-screen tab)
- All form components (WorkForm, BasicsForm, etc.)
- Auto-save logic in `initAutoSave`
- `EditorErrorBoundary` — still wraps each tab's content in the left panel

---

## File Map

| File | Change |
|------|--------|
| `components/editor/EditorShell.tsx` | Full restructure — split layout, preview always visible |
| `components/editor/PreviewTab.tsx` | Remove zoom controls, always-fit canvas |
| `components/editor/AccordionSection.tsx` | Add `onMoveUp?` / `onMoveDown?` props |
| `components/editor/EditTab.tsx` | Wire `onMoveUp` / `onMoveDown` to accordion, remove basics from reorder |
| `components/editor/DesignPanel.tsx` | Remove SectionOrderEditor block |
| `components/editor/AccordionSection.test.tsx` | Add 4 reorder button tests |
| `components/editor/EditTab.test.tsx` | New — 4 tests for section reordering |
| `components/editor/DesignPanel.test.tsx` | Remove 5 SectionOrderEditor tests |
