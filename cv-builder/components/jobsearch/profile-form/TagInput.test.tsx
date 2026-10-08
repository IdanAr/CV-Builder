// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { TagInput } from './TagInput'

function Harness({ initial = [], max }: { initial?: string[]; max?: number }) {
  const [values, setValues] = useState(initial)
  return <TagInput id="roles" label="Target roles" values={values} onChange={setValues} max={max} helper="Press Enter to add." />
}

describe('TagInput', () => {
  it('adds a tag on Enter and clears the field', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Target roles')
    await userEvent.type(input, 'Frontend engineer{Enter}')
    expect(screen.getByText('Frontend engineer')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('adds a tag on comma and keeps the remainder', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Target roles')
    await userEvent.type(input, 'React dev,Vue')
    expect(screen.getByText('React dev')).toBeInTheDocument()
    expect(input).toHaveValue('Vue')
  })

  it('splits a pasted comma-separated list into tags', () => {
    render(<Harness />)
    fireEvent.change(screen.getByLabelText('Target roles'), { target: { value: 'A, B, C,' } })
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(3)
  })

  it('commits pending text on blur so Next never loses it', async () => {
    render(<Harness />)
    const input = screen.getByLabelText('Target roles')
    await userEvent.type(input, 'Data analyst')
    await userEvent.tab()
    expect(screen.getByText('Data analyst')).toBeInTheDocument()
  })

  it('ignores duplicates case-insensitively', async () => {
    render(<Harness initial={['React']} />)
    await userEvent.type(screen.getByLabelText('Target roles'), 'react{Enter}')
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(1)
  })

  it('removes the last tag on Backspace in an empty field and any tag from its button', async () => {
    render(<Harness initial={['A', 'B']} />)
    await userEvent.type(screen.getByLabelText('Target roles'), '{Backspace}')
    expect(screen.queryByText('B')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Remove A' }))
    expect(screen.queryByText('A')).not.toBeInTheDocument()
  })

  it('does not add while an IME composition is active', () => {
    render(<Harness />)
    const input = screen.getByLabelText('Target roles')
    fireEvent.change(input, { target: { value: 'ありがとう' } })
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
  })

  it('stops adding at max', async () => {
    render(<Harness initial={['A', 'B']} max={2} />)
    await userEvent.type(screen.getByLabelText('Target roles'), 'C{Enter}')
    expect(screen.queryByText('C')).not.toBeInTheDocument()
  })

  it('shows its helper text and meets the mobile target floor', () => {
    render(<Harness initial={['A']} />)
    expect(screen.getByText('Press Enter to add.')).toBeInTheDocument()
    expect(screen.getByLabelText('Target roles').className).toContain('max-sm:min-h-10')
    expect(screen.getByRole('button', { name: 'Remove A' }).className).toContain('max-sm:h-10')
  })

  it('calls onChange once per commit', async () => {
    const onChange = vi.fn()
    render(<TagInput id="x" label="X" values={[]} onChange={onChange} />)
    await userEvent.type(screen.getByLabelText('X'), 'a{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['a'])
  })
})
