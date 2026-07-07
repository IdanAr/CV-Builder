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
})
