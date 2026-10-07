// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from './SegmentedControl'

const options = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

function setup(value: string | undefined) {
  const onChange = vi.fn()
  render(<SegmentedControl label="Pick" options={options} value={value} onChange={onChange} />)
  return onChange
}

describe('SegmentedControl', () => {
  it('renders a named radiogroup with radios and marks the selected one', () => {
    setup('b')
    expect(screen.getByRole('radiogroup', { name: 'Pick' })).toBeTruthy()
    expect(screen.getAllByRole('radio')).toHaveLength(3)
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveProperty('tabIndex', 0)
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveProperty('tabIndex', -1)
  })

  it('calls onChange on click', () => {
    const onChange = setup('a')
    fireEvent.click(screen.getByRole('radio', { name: 'Gamma' }))
    expect(onChange).toHaveBeenCalledWith('c')
  })

  it('does not call onChange for the already-selected option', () => {
    const onChange = setup('b')
    fireEvent.click(screen.getByRole('radio', { name: 'Beta' }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('ArrowRight and ArrowLeft wrap, call onChange and move focus', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SegmentedControl label="Pick" options={options} value="c" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Gamma' }), { key: 'ArrowRight' })
    expect(onChange).toHaveBeenLastCalledWith('a')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Alpha' }))
    rerender(<SegmentedControl label="Pick" options={options} value="a" onChange={onChange} />)
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Alpha' }), { key: 'ArrowLeft' })
    expect(onChange).toHaveBeenLastCalledWith('c')
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Gamma' }))
  })

  it('Home and End jump to the ends', () => {
    const onChange = setup('b')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Beta' }), { key: 'End' })
    expect(onChange).toHaveBeenLastCalledWith('c')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Beta' }), { key: 'Home' })
    expect(onChange).toHaveBeenLastCalledWith('a')
  })

  it('with no value nothing is checked and the first radio is tabbable', () => {
    setup(undefined)
    for (const r of screen.getAllByRole('radio')) expect(r).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveProperty('tabIndex', 0)
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveProperty('tabIndex', -1)
  })
})
