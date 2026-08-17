// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ColumnForm } from './ColumnForm'
import { defaultBoardColumns } from '@/lib/schemas/application.zod'

describe('ColumnForm (add mode)', () => {
  it('submits a text column with just a name', () => {
    const onSubmit = vi.fn()
    render(<ColumnForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/column name/i), { target: { value: 'Recruiter' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }))

    expect(onSubmit).toHaveBeenCalledWith({ label: 'Recruiter', type: 'text', options: undefined })
  })

  it('disables submit until a name is entered', () => {
    render(<ColumnForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Add column' })).toBeDisabled()
  })

  it('shows the option editor for select type and requires at least one labeled option', () => {
    const onSubmit = vi.fn()
    render(<ColumnForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/column name/i), { target: { value: 'Source' } })
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: 'select' } })

    // One empty option row exists; submit stays disabled until it has a label.
    expect(screen.getByRole('button', { name: 'Add column' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('Label for option 1'), { target: { value: 'LinkedIn' } })
    fireEvent.click(screen.getByRole('button', { name: '+ Add option' }))
    fireEvent.change(screen.getByLabelText('Label for option 2'), { target: { value: 'Referral' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const result = onSubmit.mock.calls[0][0]
    expect(result.type).toBe('select')
    expect(result.options.map((o: { label: string }) => o.label)).toEqual(['LinkedIn', 'Referral'])
    expect(result.options.every((o: { color: string }) => o.color.startsWith('#'))).toBe(true)
  })

  it('offers preset color swatches as named, clickable buttons', () => {
    render(<ColumnForm onSubmit={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText(/column name/i), { target: { value: 'Source' } })
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: 'select' } })

    const swatches = screen.getAllByRole('button', { name: /set color to #/i })
    expect(swatches.length).toBeGreaterThan(0)
  })

  it('sets the option color when a preset swatch is clicked', () => {
    const onSubmit = vi.fn()
    render(<ColumnForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/column name/i), { target: { value: 'Source' } })
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: 'select' } })
    fireEvent.change(screen.getByLabelText('Label for option 1'), { target: { value: 'LinkedIn' } })

    fireEvent.click(screen.getByRole('button', { name: 'Set color to #ef4444' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add column' }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const result = onSubmit.mock.calls[0][0]
    expect(result.options[0].color).toBe('#ef4444')
  })
})

describe('ColumnForm (edit mode)', () => {
  it('locks the type and pre-fills label and options for a status column', () => {
    const statusColumn = defaultBoardColumns().find((c) => c.id === 'status')!
    const onSubmit = vi.fn()
    render(<ColumnForm initial={statusColumn} onSubmit={onSubmit} onCancel={vi.fn()} />)

    expect(screen.getByLabelText(/^type$/i)).toBeDisabled()
    expect(screen.getByLabelText(/column name/i)).toHaveValue('Status')
    expect(screen.getByLabelText('Label for option 1')).toHaveValue('Applied')

    // Rename an option and save
    fireEvent.change(screen.getByLabelText('Label for option 1'), { target: { value: 'Wishlist' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save column' }))

    const result = onSubmit.mock.calls[0][0]
    expect(result.label).toBe('Status')
    expect(result.options[0]).toEqual(
      expect.objectContaining({ id: 'applied', label: 'Wishlist' })
    )
  })

  it('can remove an option (but never the last one)', () => {
    const statusColumn = defaultBoardColumns().find((c) => c.id === 'status')!
    render(<ColumnForm initial={statusColumn} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Remove option 4'))
    expect(screen.queryByDisplayValue('Rejected')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Remove option 3'))
    fireEvent.click(screen.getByLabelText('Remove option 2'))
    expect(screen.getByLabelText('Remove option 1')).toBeDisabled()
  })

  it('moves an option up, swapping it with the previous one', () => {
    const statusColumn = defaultBoardColumns().find((c) => c.id === 'status')!
    render(<ColumnForm initial={statusColumn} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    // Move "Interviewing" (option 2) up, ahead of "Applied" (option 1).
    fireEvent.click(screen.getByLabelText('Move option 2 up'))

    const labels = screen
      .getAllByLabelText(/^Label for option \d+$/)
      .map((el) => (el as HTMLInputElement).value)
    expect(labels).toEqual(['Interviewing', 'Applied', 'Offer', 'Rejected'])
  })

  it('moves an option down, swapping it with the next one', () => {
    const statusColumn = defaultBoardColumns().find((c) => c.id === 'status')!
    render(<ColumnForm initial={statusColumn} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    // Move "Applied" (option 1) down, behind "Interviewing" (option 2).
    fireEvent.click(screen.getByLabelText('Move option 1 down'))

    const labels = screen
      .getAllByLabelText(/^Label for option \d+$/)
      .map((el) => (el as HTMLInputElement).value)
    expect(labels).toEqual(['Interviewing', 'Applied', 'Offer', 'Rejected'])
  })

  it('disables move-up on the first option and move-down on the last option', () => {
    const statusColumn = defaultBoardColumns().find((c) => c.id === 'status')!
    render(<ColumnForm initial={statusColumn} onSubmit={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Move option 1 up')).toBeDisabled()
    expect(screen.getByLabelText('Move option 4 down')).toBeDisabled()
    // Middle options are enabled in both directions.
    expect(screen.getByLabelText('Move option 2 up')).not.toBeDisabled()
    expect(screen.getByLabelText('Move option 2 down')).not.toBeDisabled()
  })

  it('preserves reordered option positions through submit', () => {
    const statusColumn = defaultBoardColumns().find((c) => c.id === 'status')!
    const onSubmit = vi.fn()
    render(<ColumnForm initial={statusColumn} onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('Move option 2 up'))
    fireEvent.click(screen.getByRole('button', { name: 'Save column' }))

    const result = onSubmit.mock.calls[0][0]
    expect(result.options.map((o: { label: string }) => o.label)).toEqual([
      'Interviewing',
      'Applied',
      'Offer',
      'Rejected',
    ])
  })
})
