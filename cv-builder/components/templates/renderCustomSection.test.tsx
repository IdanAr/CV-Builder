// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { CSSProperties } from 'react'
import { renderCustomSection } from './renderCustomSection'
import type { CustomSection } from '@/lib/schemas/resume.zod'

const styles = {
  sectionTitle: { fontSize: '13pt', fontWeight: 700 } as CSSProperties,
  accentColor: '#0066cc',
}

describe('renderCustomSection', () => {
  it('returns null when items array is empty', () => {
    const section: CustomSection = { id: '1', name: 'Empty', enabledFields: [], items: [] }
    const result = renderCustomSection(section, styles, 'custom:1')
    expect(result).toBeNull()
  })

  it('renders the section name', () => {
    const section: CustomSection = {
      id: '1', name: 'My Publications', enabledFields: [],
      items: [{ id: 'i1', title: 'Paper One' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('My Publications')).toBeTruthy()
  })

  it('renders item title always', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: [],
      items: [{ id: 'i1', title: 'The Title' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('The Title')).toBeTruthy()
  })

  it('renders subtitle only when enabledFields includes subtitle', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['subtitle'],
      items: [{ id: 'i1', title: 'T', subtitle: 'Sub Text' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('Sub Text')).toBeTruthy()
  })

  it('does not render subtitle when not in enabledFields', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: [],
      items: [{ id: 'i1', title: 'T', subtitle: 'Hidden' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('renders summary when enabledFields includes summary', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['summary'],
      items: [{ id: 'i1', title: 'T', summary: 'Detail text here' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('Detail text here')).toBeTruthy()
  })

  it('renders highlights as list items when enabledFields includes highlights', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['highlights'],
      items: [{ id: 'i1', title: 'T', highlights: ['Bullet A', 'Bullet B'] }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('Bullet A')).toBeTruthy()
    expect(screen.getByText('Bullet B')).toBeTruthy()
  })

  it('renders keywords joined by · when enabledFields includes keywords', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['keywords'],
      items: [{ id: 'i1', title: 'T', keywords: ['React', 'TypeScript'] }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('React · TypeScript')).toBeTruthy()
  })

  it('renders level when enabledFields includes level', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['level'],
      items: [{ id: 'i1', title: 'T', level: 'Advanced' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('Level: Advanced')).toBeTruthy()
  })

  it('renders date range when enabledFields includes dateRange', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['dateRange'],
      items: [{ id: 'i1', title: 'T', startDate: '2022-01', endDate: '2023-06' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('01/2022 - 06/2023')).toBeTruthy()
  })

  it('renders url when enabledFields includes url', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: ['url'],
      items: [{ id: 'i1', title: 'T', url: 'https://example.com' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.getByText('https://example.com')).toBeTruthy()
  })

  it('does not render url when not in enabledFields', () => {
    const section: CustomSection = {
      id: '1', name: 'S', enabledFields: [],
      items: [{ id: 'i1', title: 'T', url: 'https://hidden.com' }],
    }
    render(<div>{renderCustomSection(section, styles, 'custom:1')}</div>)
    expect(screen.queryByText('https://hidden.com')).toBeNull()
  })

  it('renders nested roles beneath the item when enabledFields includes roles', () => {
    const section: CustomSection = {
      id: 'cs1', name: 'Military Service', enabledFields: ['dateRange', 'summary', 'roles'],
      items: [{
        id: 'i1', title: 'IDF - Intelligence Corps', startDate: '2016-03', endDate: '2018-03',
        roles: [{ id: 'r1', title: 'Team Commander', startDate: '2018-03', endDate: '2019-03', summary: 'Led a 6-person team.' }],
      }],
    }
    const { container } = render(
      <div>{renderCustomSection(section, { sectionTitle: {}, accentColor: '#0066cc' }, 'custom:cs1')}</div>
    )
    const text = container.textContent ?? ''
    expect(text).toContain('Team Commander')
    expect(text).toContain('Led a 6-person team.')
  })

  it('does not render a roles block when enabledFields excludes roles', () => {
    const section: CustomSection = {
      id: 'cs1', name: 'Military Service', enabledFields: ['dateRange'],
      items: [{ id: 'i1', title: 'IDF', roles: [{ id: 'r1', title: 'Team Commander' }] }],
    }
    const { container } = render(
      <div>{renderCustomSection(section, { sectionTitle: {}, accentColor: '#0066cc' }, 'custom:cs1')}</div>
    )
    expect(container.textContent ?? '').not.toContain('Team Commander')
  })
})
