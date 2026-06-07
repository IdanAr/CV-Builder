// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccordionSection } from './AccordionSection'

describe('AccordionSection', () => {
  it('renders title and calls onToggle on click', () => {
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByText('Work Experience')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /work experience/i }))
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

  it('does not render ↑↓ buttons when callbacks are omitted', () => {
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.queryByRole('button', { name: /move work experience up/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /move work experience down/i })).toBeNull()
  })

  it('renders ↑ button when onMoveUp provided, ↓ when onMoveDown provided', () => {
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={vi.fn()}
        onMoveUp={vi.fn()} onMoveDown={vi.fn()}>
        {null}
      </AccordionSection>
    )
    expect(screen.getByRole('button', { name: /move work experience up/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /move work experience down/i })).toBeTruthy()
  })

  it('clicking ↑ calls onMoveUp and does NOT call onToggle', () => {
    const onMoveUp = vi.fn()
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle} onMoveUp={onMoveUp}>
        {null}
      </AccordionSection>
    )
    fireEvent.click(screen.getByRole('button', { name: /move work experience up/i }))
    expect(onMoveUp).toHaveBeenCalledOnce()
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('clicking ↓ calls onMoveDown and does NOT call onToggle', () => {
    const onMoveDown = vi.fn()
    const onToggle = vi.fn()
    render(
      <AccordionSection title="Work Experience" isOpen={false} onToggle={onToggle} onMoveDown={onMoveDown}>
        {null}
      </AccordionSection>
    )
    fireEvent.click(screen.getByRole('button', { name: /move work experience down/i }))
    expect(onMoveDown).toHaveBeenCalledOnce()
    expect(onToggle).not.toHaveBeenCalled()
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
