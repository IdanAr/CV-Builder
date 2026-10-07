// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShortcutsHelp, SHORTCUTS } from './ShortcutsHelp'

describe('ShortcutsHelp', () => {
  it('opens a popover listing every shortcut and the optional note', async () => {
    render(<ShortcutsHelp />)
    expect(screen.queryByText('Open')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /keyboard shortcuts/i }))
    expect(SHORTCUTS).toHaveLength(4)
    for (const s of SHORTCUTS) {
      expect(screen.getByText(s.keys)).toBeTruthy()
      expect(screen.getByText(s.label)).toBeTruthy()
    }
    expect(screen.getByText('Shortcuts are optional; every action also has a button.')).toBeTruthy()
  })

  it('keeps a 40px touch target on mobile', () => {
    render(<ShortcutsHelp />)
    expect(screen.getByRole('button', { name: /keyboard shortcuts/i }).classList.contains('min-h-10')).toBe(true)
  })
})
