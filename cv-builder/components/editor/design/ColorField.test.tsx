// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColorField } from './ColorField'

const errorText = 'Enter a valid hex color (e.g. #0066cc)'

function setup(value = '#000000') {
  const onCommit = vi.fn()
  const utils = render(
    <ColorField
      label="Primary color"
      value={value}
      onCommit={onCommit}
      swatchLabel="Custom primary color"
      presetsLabel="Primary color presets"
      placeholder="#000000"
    />
  )
  const text = screen.getByPlaceholderText('#000000') as HTMLInputElement
  return { onCommit, text, ...utils }
}

describe('ColorField', () => {
  it('shows no error before interaction and labels the text input', () => {
    const { text } = setup()
    expect(screen.queryByText(errorText)).toBeNull()
    expect(screen.getByLabelText('Primary color')).toBe(text)
    expect(screen.getByLabelText('Custom primary color')).toBeInTheDocument()
  })

  it('commits a valid hex typed into the text input', () => {
    const { text, onCommit } = setup()
    fireEvent.change(text, { target: { value: '#123abc' } })
    expect(onCommit).toHaveBeenCalledWith('#123abc')
    expect(screen.queryByText(errorText)).toBeNull()
  })

  it('shows an error for an invalid hex and does not commit', () => {
    const { text, onCommit } = setup()
    fireEvent.change(text, { target: { value: 'purple' } })
    expect(screen.getByText(errorText)).toBeTruthy()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('reverts the draft and clears the error on blur while invalid', () => {
    const { text } = setup()
    fireEvent.change(text, { target: { value: 'purple' } })
    fireEvent.blur(text)
    expect(text.value).toBe('#000000')
    expect(screen.queryByText(errorText)).toBeNull()
  })

  it('keeps a valid draft on blur', () => {
    const { text } = setup()
    fireEvent.change(text, { target: { value: '#abc' } })
    fireEvent.blur(text)
    expect(text.value).toBe('#abc')
  })

  it('commits from the native swatch and syncs the draft', () => {
    const { onCommit, text } = setup()
    fireEvent.change(screen.getByLabelText('Custom primary color'), { target: { value: '#abcdef' } })
    expect(onCommit).toHaveBeenCalledWith('#abcdef')
    expect(text.value).toBe('#abcdef')
  })

  it('commits a preset click, syncs the draft, and names the swatch after the label', () => {
    const { onCommit, text } = setup()
    fireEvent.click(screen.getByRole('button', { name: 'Set primary color to Navy' }))
    expect(onCommit).toHaveBeenCalledWith('#1e3a8a')
    expect(text.value).toBe('#1e3a8a')
  })

  it('marks the preset matching the value (case-insensitive) as pressed', () => {
    setup('#1E3A8A')
    expect(screen.getByRole('button', { name: 'Set primary color to Navy' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Set primary color to Black' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('resyncs the draft and clears the error when value changes externally', () => {
    const { text, rerender } = setup()
    fireEvent.change(text, { target: { value: 'nope' } })
    expect(screen.getByText(errorText)).toBeTruthy()
    rerender(
      <ColorField
        label="Primary color"
        value="#ff0000"
        onCommit={() => {}}
        swatchLabel="Custom primary color"
        presetsLabel="Primary color presets"
        placeholder="#000000"
      />
    )
    expect(text.value).toBe('#ff0000')
    expect(screen.queryByText(errorText)).toBeNull()
  })
})
