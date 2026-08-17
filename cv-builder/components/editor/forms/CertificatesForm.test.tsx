// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'
import { CertificatesForm } from './CertificatesForm'
import type { ResumeMeta } from '@/lib/schemas/resume.zod'

const defaultMeta: ResumeMeta = {
  templateId: 'classic', fontFamily: 'Calibri', headerFontFamily: 'Calibri',
  primaryColor: '#000000', accentColor: '#0066cc',
  pageMargins: 1.0, sidebarRailWidth: 33, lineSpacing: 1.15, sectionOrder: [], layout: 'single-column',
  columnAssignment: {}, excludedAtsKeywords: [],
}

beforeEach(() => {
  useResumeEditorStore.setState({
    resumeId: 'r1', title: 'CV', data: {}, meta: defaultMeta,
    isDirty: false, isSaving: false, saveError: null,
  })
})

it('renders empty state with an Add certificate button', () => {
  render(<CertificatesForm />)
  expect(screen.getByText('+ Add certificate')).toBeInTheDocument()
  expect(useResumeEditorStore.getState().data.certificates ?? []).toHaveLength(0)
})

it('adds a certificate entry when Add button clicked', () => {
  render(<CertificatesForm />)
  fireEvent.click(screen.getByText('+ Add certificate'))
  expect(useResumeEditorStore.getState().data.certificates).toHaveLength(1)
  expect(useResumeEditorStore.getState().isDirty).toBe(true)
  expect(screen.getByPlaceholderText('Certificate name')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('Issuer')).toBeInTheDocument()
  expect(screen.getByPlaceholderText('URL')).toBeInTheDocument()
})

it('removes a certificate entry when Remove clicked', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { certificates: [{ name: 'AWS SAA', issuer: 'Amazon', date: '', url: '' }] },
  })
  render(<CertificatesForm />)
  fireEvent.click(screen.getByLabelText('Remove certificate entry'))
  expect(useResumeEditorStore.getState().data.certificates).toHaveLength(0)
})

it('updates certificate name in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { certificates: [{ name: '', issuer: '', date: '', url: '' }] },
  })
  render(<CertificatesForm />)
  fireEvent.change(screen.getByPlaceholderText('Certificate name'), { target: { value: 'AWS SAA' } })
  expect(useResumeEditorStore.getState().data.certificates?.[0].name).toBe('AWS SAA')
})

it('updates issuer in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { certificates: [{ name: '', issuer: '', date: '', url: '' }] },
  })
  render(<CertificatesForm />)
  fireEvent.change(screen.getByPlaceholderText('Issuer'), { target: { value: 'Amazon' } })
  expect(useResumeEditorStore.getState().data.certificates?.[0].issuer).toBe('Amazon')
})

it('updates url in store on input change', () => {
  useResumeEditorStore.setState({
    ...useResumeEditorStore.getState(),
    data: { certificates: [{ name: '', issuer: '', date: '', url: '' }] },
  })
  render(<CertificatesForm />)
  fireEvent.change(screen.getByPlaceholderText('URL'), { target: { value: 'https://aws.amazon.com/cert' } })
  expect(useResumeEditorStore.getState().data.certificates?.[0].url).toBe('https://aws.amazon.com/cert')
})
