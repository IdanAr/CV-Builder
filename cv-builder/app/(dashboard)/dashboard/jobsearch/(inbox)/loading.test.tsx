// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import JobSearchLoading from './loading'

describe('jobsearch inbox loading', () => {
  it('uses the same page frame as the inbox so nothing jumps', () => {
    render(<JobSearchLoading />)
    const cls = screen.getByRole('status').className
    for (const c of ['mx-auto', 'w-full', 'max-w-6xl', 'px-4', 'py-6', 'sm:px-6', 'sm:py-8']) expect(cls).toContain(c)
  })
})
