'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useResumeEditorStore, initAutoSave } from '@/lib/stores/resume-editor.store'
import { EditTab } from './EditTab'
import { PreviewTab } from './PreviewTab'
import { DesignPanel } from './DesignPanel'
import { AtsScorePanel } from '@/components/ats/AtsScorePanel'
import { EditorErrorBoundary } from './EditorErrorBoundary'
import { AppNavbar } from '@/components/ui/AppNavbar'
import type { ResumeData, ResumeMeta } from '@/lib/schemas/resume.zod'

type Tab = 'edit' | 'design' | 'ats'

const TAB_LABELS: Record<Tab, string> = { edit: 'Edit', design: 'Design', ats: 'ATS' }

export interface EditorShellProps {
  resumeId: string
  title: string
  data: ResumeData
  meta: ResumeMeta
}

export function EditorShell({ resumeId, title, data, meta }: EditorShellProps) {
  const [activeTab, setActiveTab] = useState<Tab>('edit')
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const storeTitle = useResumeEditorStore((s) => s.title)
  const isDirty = useResumeEditorStore((s) => s.isDirty)
  const isSaving = useResumeEditorStore((s) => s.isSaving)
  const saveError = useResumeEditorStore((s) => s.saveError)
  const setTitle = useResumeEditorStore((s) => s.setTitle)
  const hydrate = useResumeEditorStore((s) => s.hydrate)

  useEffect(() => {
    hydrate(resumeId, title, data, meta)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return initAutoSave()
  }, [])

  function handleJsonExport() {
    const s = useResumeEditorStore.getState()
    const blob = new Blob([JSON.stringify({ data: s.data, meta: s.meta }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${s.title.replace(/\s+/g, '-')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleExport(format: 'pdf' | 'docx') {
    const { resumeId: rid, title: t } = useResumeEditorStore.getState()
    try {
      const res = await fetch(`/api/resumes/${rid}/export/${format}`, { method: 'POST' })
      if (!res.ok) throw new Error(`Export failed: ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${t.replace(/\s+/g, '-')}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Export failed. Please try again.')
    }
  }

  const saveStatus = isSaving ? 'Saving…' : isDirty ? '● Unsaved' : 'Saved'

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top navbar */}
      <AppNavbar
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              ← My CVs
            </Link>
            <span className="text-indigo-200">|</span>
            <span className={`text-xs ${saveError ? 'text-red-500' : 'text-indigo-400'}`}>
              {saveError ?? saveStatus}
            </span>
            <div className="w-px h-4 bg-indigo-200 mx-1" />
            <button
              onClick={handleJsonExport}
              className="text-xs border border-indigo-200 text-indigo-600 rounded px-3 py-1.5 hover:bg-indigo-50 transition-colors"
            >
              JSON
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="text-xs bg-indigo-600 text-white rounded px-3 py-1.5 hover:bg-indigo-700 transition-colors"
            >
              PDF
            </button>
            <button
              onClick={() => handleExport('docx')}
              className="text-xs border border-indigo-200 text-indigo-600 rounded px-3 py-1.5 hover:bg-indigo-50 transition-colors"
            >
              DOCX
            </button>
          </div>
        }
      />

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel */}
        {previewExpanded ? (
          <div className="w-9 min-w-[36px] bg-indigo-900 flex flex-col items-center py-3 gap-4 border-r border-indigo-800 shrink-0">
            {(['edit', 'design', 'ats'] as Tab[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => { setPreviewExpanded(false); setActiveTab(tab) }}
                className="text-xs text-indigo-300 hover:text-white transition-colors"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        ) : (
          <div className="w-80 min-w-[320px] flex flex-col border-r border-white/20 bg-white/40 backdrop-blur-xl shrink-0">
            {/* Title + save status */}
            <div className="flex items-center gap-3 px-4 py-2 border-b border-indigo-100 shrink-0 bg-white/50">
              <input
                type="text"
                value={storeTitle}
                onChange={(e) => setTitle(e.target.value)}
                className="font-semibold text-sm bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1 min-w-0 flex-1 text-indigo-900"
              />
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-indigo-100 shrink-0 bg-white/50">
              {(['edit', 'design', 'ats'] as Tab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-indigo-400 hover:text-indigo-600'
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto">
              <div className={activeTab === 'edit' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><EditTab /></EditorErrorBoundary>
              </div>
              <div className={activeTab === 'design' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><DesignPanel /></EditorErrorBoundary>
              </div>
              <div className={activeTab === 'ats' ? 'block' : 'hidden'}>
                <EditorErrorBoundary><AtsScorePanel /></EditorErrorBoundary>
              </div>
            </div>
          </div>
        )}

        {/* Right panel — preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-indigo-100 bg-white/50 shrink-0">
            <span className="text-xs font-medium text-indigo-500 flex-1">Live Preview</span>
            <button
              onClick={() => setPreviewExpanded((v) => !v)}
              title={previewExpanded ? 'Collapse preview' : 'Expand preview'}
              className={`text-sm border rounded px-2 py-1 transition-colors ${
                previewExpanded
                  ? 'border-indigo-400 bg-indigo-50 text-indigo-600'
                  : 'border-indigo-200 text-indigo-500 hover:bg-indigo-50'
              }`}
            >
              ⛶
            </button>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <EditorErrorBoundary><PreviewTab /></EditorErrorBoundary>
          </div>
        </div>
      </div>
    </div>
  )
}
