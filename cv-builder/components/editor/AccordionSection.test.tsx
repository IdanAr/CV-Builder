// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
      attributes: {} as any,
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
})
