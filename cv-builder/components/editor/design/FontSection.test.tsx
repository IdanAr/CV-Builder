// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { FontSection } from './FontSection'
import { FONT_SUBSTITUTES, webFontFamily } from '@/lib/fonts/families'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic',
  fontFamily: 'Calibri',
  headerFontFamily: 'Calibri',
  primaryColor: '#000000',
  accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33,
  lineSpacing: 1.15,
  sectionOrder: ['work', 'education', 'skills'],
  layout: 'single-column',
  columnAssignment: {},
  excludedAtsKeywords: [], fontScale: 1,
}

const q = (f: string) => f.replace(/"/g, "'")
const meta = () => useResumeEditorStore.getState().meta

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
    _history: [], _future: [], canUndo: false, canRedo: false,
  })
})

describe('FontSection', () => {
  it('renders four pairing cards in a radiogroup with Aa samples', () => {
    render(<FontSection />)
    const group = screen.getByRole('radiogroup', { name: 'Font pairing' })
    const cards = within(group).getAllByRole('radio')
    expect(cards).toHaveLength(4)
    const sample = within(screen.getByRole('radio', { name: /Editorial/ })).getByText('Aa')
    expect(q(sample.style.fontFamily)).toBe(webFontFamily('Cambria'))
  })

  it('checks the matching pairing (Clean by default)', () => {
    render(<FontSection />)
    expect(screen.getByRole('radio', { name: /Clean/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('clicking Editorial sets both fonts in one history entry', () => {
    render(<FontSection />)
    fireEvent.click(screen.getByRole('radio', { name: /Editorial/ }))
    expect(meta().headerFontFamily).toBe('Cambria')
    expect(meta().fontFamily).toBe('Calibri')
    expect(useResumeEditorStore.getState()._history).toHaveLength(1)
    act(() => useResumeEditorStore.getState().undo())
    expect(meta().headerFontFamily).toBe('Calibri')
    expect(meta().fontFamily).toBe('Calibri')
  })

  it('clicking the already-selected pairing records nothing', () => {
    render(<FontSection />)
    fireEvent.click(screen.getByRole('radio', { name: /Clean/ }))
    const st = useResumeEditorStore.getState()
    expect(st._history).toHaveLength(0)
    expect(st.isDirty).toBe(false)
  })

  it('shows Custom and no checked pairing when nothing matches', () => {
    useResumeEditorStore.setState({ meta: { ...defaultMeta, fontFamily: 'Roboto', headerFontFamily: 'Lato' } })
    render(<FontSection />)
    const group = screen.getByRole('radiogroup', { name: 'Font pairing' })
    for (const r of group.querySelectorAll('[role="radio"]')) expect(r).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('Custom')).toBeTruthy()
  })

  it('arrow keys move through pairings', () => {
    render(<FontSection />)
    const clean = screen.getByRole('radio', { name: /Clean/ })
    fireEvent.keyDown(clean, { key: 'ArrowRight' })
    expect(meta().headerFontFamily).toBe('Cambria')
    const editorial = screen.getByRole('radio', { name: /Editorial/ })
    expect(editorial).toHaveAttribute('tabindex', '0')
    expect(clean).toHaveAttribute('tabindex', '-1')
    expect(document.activeElement).toBe(editorial)
  })

  it('Headings target edits only headerFontFamily', () => {
    render(<FontSection />)
    expect(screen.getByRole('radiogroup', { name: 'Customize font target' })).toBeTruthy()
    fireEvent.click(screen.getByRole('radio', { name: 'Headings' }))
    const list = screen.getByRole('radiogroup', { name: 'Fonts for headings' })
    fireEvent.click(within(list).getByRole('radio', { name: 'Georgia' }))
    expect(meta().headerFontFamily).toBe('Georgia')
    expect(meta().fontFamily).toBe('Calibri')
  })

  it('Body target edits only fontFamily', () => {
    render(<FontSection />)
    const list = screen.getByRole('radiogroup', { name: 'Fonts for body' })
    fireEvent.click(within(list).getByRole('radio', { name: 'Lato' }))
    expect(meta().fontFamily).toBe('Lato')
    expect(meta().headerFontFamily).toBe('Calibri')
  })

  it('lists the 9 fonts, each rendered in its own family, current one checked', () => {
    render(<FontSection />)
    const list = screen.getByRole('radiogroup', { name: 'Fonts for body' })
    const opts = within(list).getAllByRole('radio')
    expect(opts.map((o) => o.textContent)).toEqual(Object.keys(FONT_SUBSTITUTES))
    for (const o of opts) expect(q((o as HTMLElement).style.fontFamily)).toBe(webFontFamily(o.textContent!))
    expect(within(list).getByRole('radio', { name: 'Calibri' })).toHaveAttribute('aria-checked', 'true')
    expect(within(list).getByRole('radio', { name: 'Arial' })).toHaveAttribute('aria-checked', 'false')
  })

  describe('font list keyboard + targets', () => {
    const fontList = (name = 'Fonts for body') => screen.getByRole('radiogroup', { name })
    const names = Object.keys(FONT_SUBSTITUTES)

    it('has exactly one tab stop and arrows move selection and focus', () => {
      render(<FontSection />)
      const opts = within(fontList()).getAllByRole('radio')
      expect(opts.filter((o) => o.getAttribute('tabindex') === '0')).toHaveLength(1)
      expect(within(fontList()).getByRole('radio', { name: 'Calibri' })).toHaveAttribute('tabindex', '0')
      fireEvent.keyDown(within(fontList()).getByRole('radio', { name: 'Calibri' }), { key: 'ArrowDown' })
      expect(meta().fontFamily).toBe(names[1])
      expect(document.activeElement).toBe(within(fontList()).getByRole('radio', { name: names[1] }))
    })

    it('ArrowUp from the first wraps to the last; Home/End work', () => {
      render(<FontSection />)
      fireEvent.keyDown(within(fontList()).getByRole('radio', { name: 'Calibri' }), { key: 'ArrowUp' })
      expect(meta().fontFamily).toBe(names[names.length - 1])
      fireEvent.keyDown(document.activeElement as Element, { key: 'Home' })
      expect(meta().fontFamily).toBe(names[0])
      fireEvent.keyDown(document.activeElement as Element, { key: 'End' })
      expect(meta().fontFamily).toBe(names[names.length - 1])
    })

    it('arrows on Headings write headerFontFamily only', () => {
      render(<FontSection />)
      fireEvent.click(screen.getByRole('radio', { name: 'Headings' }))
      fireEvent.keyDown(within(fontList('Fonts for headings')).getByRole('radio', { name: 'Calibri' }), { key: 'ArrowDown' })
      expect(meta().headerFontFamily).toBe(names[1])
      expect(meta().fontFamily).toBe('Calibri')
    })

    it('list checked state follows the target', () => {
      useResumeEditorStore.setState({ meta: { ...defaultMeta, headerFontFamily: 'Cambria', fontFamily: 'Calibri' } })
      render(<FontSection />)
      expect(within(fontList()).getByRole('radio', { name: 'Calibri' })).toHaveAttribute('aria-checked', 'true')
      fireEvent.click(screen.getByRole('radio', { name: 'Headings' }))
      expect(within(fontList('Fonts for headings')).getByRole('radio', { name: 'Cambria' })).toHaveAttribute('aria-checked', 'true')
      expect(within(fontList('Fonts for headings')).getByRole('radio', { name: 'Calibri' })).toHaveAttribute('aria-checked', 'false')
      fireEvent.click(screen.getByRole('radio', { name: 'Body' }))
      expect(within(fontList()).getByRole('radio', { name: 'Calibri' })).toHaveAttribute('aria-checked', 'true')
    })

    it('legacy CV without headerFontFamily falls back to the body font', () => {
      useResumeEditorStore.setState({
        meta: { ...defaultMeta, headerFontFamily: undefined as unknown as string, fontFamily: 'Calibri' },
      })
      render(<FontSection />)
      expect(screen.getByRole('radio', { name: /Clean/ })).toHaveAttribute('aria-checked', 'true')
      fireEvent.click(screen.getByRole('radio', { name: 'Headings' }))
      expect(within(fontList('Fonts for headings')).getByRole('radio', { name: 'Calibri' })).toHaveAttribute('aria-checked', 'true')
    })
  })
})
