// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { DraggableAttributes } from '@dnd-kit/core'
import { AccordionSection } from './AccordionSection'

// CSS.Transform.toString is from @dnd-kit/utilities; mock it for jsdom
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}))

describe('AccordionSection', () => {
  it('renders title and calls onToggle on click', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByText('Work Experience')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Work Experience' }))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('shows children when isOpen is true', () => {
    render(
      <AccordionSection title="Skills" isOpen={true} onToggle={vi.fn()}>
        <span>skill content</span>
      </AccordionSection>
    )
    expect(screen.getByText('skill content')).toBeTruthy()
  })

  it('hides children when isOpen is false', () => {
    render(
      <AccordionSection title="Skills" isOpen={false} onToggle={vi.fn()}>
        <span>skill content</span>
      </AccordionSection>
    )
    expect(screen.queryByText('skill content')).toBeNull()
  })

  it('renders badge when provided', () => {
    render(
      <AccordionSection title="Work" badge="3 entries" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByText('3 entries')).toBeTruthy()
  })

  it('does not render drag handle when dragHandleProps is absent', () => {
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('button', { name: /drag to reorder/i })).toBeNull()
  })

  it('renders drag handle button when dragHandleProps is provided', () => {
    const dragHandleProps = {
      listeners: undefined,
      attributes: {} as DraggableAttributes,
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()} dragHandleProps={dragHandleProps}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByRole('button', { name: /drag to reorder/i })).toBeTruthy()
  })

  it('renders title as plain text when onRename is not provided', () => {
    render(
      <AccordionSection title="Static Title" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('Static Title')).toBeTruthy()
  })

  it('renders title as input when onRename is provided', () => {
    render(
      <AccordionSection title="Custom Section" isOpen={false} onToggle={vi.fn()} onRename={vi.fn()}>
        {null}
      </AccordionSection>
    )
    const input = screen.getByRole('textbox')
    expect(input).toBeTruthy()
    expect((input as HTMLInputElement).value).toBe('Custom Section')
  })

  it('typing in the rename input calls onRename with new value, not onToggle', () => {
    const onRename = vi.fn()
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Old Name" isOpen={false} onToggle={onToggle} onRename={onRename}>
        {null}
      </AccordionSection>
    )
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New Name' } })
    expect(onRename).toHaveBeenCalledWith('New Name')
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('clicking the header area outside the input toggles the accordion (custom section)', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Custom Section" isOpen={false} onToggle={onToggle} onRename={vi.fn()}>
        {null}
      </AccordionSection>
    )
    const input = screen.getByRole('textbox')
    // The wrapper carries its own padding (not covered by the input), so a
    // click landing on the wrapper itself but not on the input is a real,
    // physically reachable scenario in the rendered DOM, not just a
    // programmatic click on a container that the input fully occupies.
    fireEvent.click(input.parentElement as HTMLElement)
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('clicking directly on the rename input does not toggle the accordion, only focuses it for editing', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Custom Section" isOpen={false} onToggle={onToggle} onRename={vi.fn()}>
        {null}
      </AccordionSection>
    )
    const input = screen.getByRole('textbox')
    // A user clicking into the field to rename it must not also collapse or
    // expand the section as a side effect — the input fills essentially all
    // of the wrapper's clickable area, so a click "on the wrapper" in
    // practice usually means a click on the input.
    fireEvent.click(input)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('does not render delete button when onDelete is not provided', () => {
    render(
      <AccordionSection title="Section" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('button', { name: /delete section/i })).toBeNull()
  })

  it('renders delete button and calls onDelete when provided', () => {
    const onDelete = vi.fn()
    render(
      <AccordionSection title="Section" isOpen={false} onToggle={vi.fn()} onDelete={onDelete}>
        {null}
      </AccordionSection>
    )
    const deleteBtn = screen.getByRole('button', { name: /delete section/i })
    fireEvent.click(deleteBtn)
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('renders the provided icon before the title', () => {
    render(
      <AccordionSection title="Work" isOpen={false} onToggle={() => {}} icon={<span data-testid="section-icon" />}>
        <p>body</p>
      </AccordionSection>
    )
    expect(screen.getByTestId('section-icon')).toBeInTheDocument()
  })

  it('renders the badge as a right-aligned sibling of the title button (built-in section)', () => {
    render(
      <AccordionSection title="Work Experience" badge="2 entries" isOpen={false} onToggle={() => {}}>
        <div>body</div>
      </AccordionSection>,
    )
    const badge = screen.getByText('2 entries')
    // Get the button that contains the title span (not the chevron button)
    const titleButton = screen.getByText('Work Experience').closest('button')
    // Badge must NOT be nested inside the title toggle button anymore
    expect(titleButton?.contains(badge)).toBe(false)
  })

  it('drag handle becomes visible when focused via keyboard', () => {
    const dragHandleProps = {
      listeners: undefined,
      attributes: {} as DraggableAttributes,
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()} dragHandleProps={dragHandleProps}>
        {null}
      </AccordionSection>
    )
    const dragHandle = screen.getByRole('button', { name: /drag to reorder/i })

    // Initially, drag handle should have opacity-0
    expect(dragHandle.className).toContain('opacity-0')

    // Focus the drag handle
    dragHandle.focus()
    expect(document.activeElement).toBe(dragHandle)

    // When focused, the ancestor group has focus-within, so opacity-100 class should apply
    expect(dragHandle.className).toContain('group-focus-within:opacity-100')
  })
})
