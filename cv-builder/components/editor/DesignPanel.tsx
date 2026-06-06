'use client'

import { useResumeEditorStore } from '@/lib/stores/resume-editor.store'

const ATS_FONTS = [
  'Calibri', 'Arial', 'Helvetica', 'Garamond', 'Cambria', 'Georgia',
  'Lato', 'Roboto', 'IBM Plex Sans',
]

const TEMPLATES = [
  { id: 'classic', label: 'Classic', desc: 'Clean, professional, thin dividers' },
  { id: 'modern', label: 'Modern', desc: 'Bold header block, accent titles' },
  { id: 'minimal', label: 'Minimal', desc: 'Typography-only, maximum ATS compatibility' },
]

export function DesignPanel() {
  const meta = useResumeEditorStore((s) => s.meta)
  const setMeta = useResumeEditorStore((s) => s.setMeta)

  const selectClass = 'w-full border border-indigo-200 rounded-lg px-2 py-1.5 text-sm bg-white/70 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
  const labelClass = 'block text-xs font-medium text-indigo-600 mb-1'

  return (
    <div className="max-w-sm mx-auto py-6 px-4 space-y-6">
      {/* Template selector */}
      <div>
        <p className={labelClass}>Template</p>
        <div className="space-y-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setMeta({ templateId: t.id })}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                meta.templateId === t.id
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{t.label}</div>
              <div className="text-xs text-gray-500 mt-0.5">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Layout toggle */}
      <div>
        <p className={labelClass}>Layout</p>
        <div className="flex gap-2">
          {(['single-column', 'two-column'] as const).map((layout) => (
            <button
              key={layout}
              type="button"
              onClick={() => setMeta({ layout })}
              className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${
                meta.layout === layout
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-medium'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {layout === 'single-column' ? 'Single column' : 'Two columns'}
            </button>
          ))}
        </div>
      </div>

      {/* Fonts */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Body font</label>
          <select value={meta.fontFamily} onChange={(e) => setMeta({ fontFamily: e.target.value })}
            className={selectClass}>
            {ATS_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>Heading font</label>
          <select value={meta.headerFontFamily} onChange={(e) => setMeta({ headerFontFamily: e.target.value })}
            className={selectClass}>
            {ATS_FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Colors */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>Primary color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={meta.primaryColor}
              onChange={(e) => setMeta({ primaryColor: e.target.value })}
              className="h-8 w-10 rounded border border-indigo-200 cursor-pointer p-0.5" />
            <input type="text" value={meta.primaryColor}
              onChange={(e) => setMeta({ primaryColor: e.target.value })}
              placeholder="#000000" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
        <div>
          <label className={labelClass}>Accent color</label>
          <div className="flex gap-2 items-center">
            <input type="color" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              className="h-8 w-10 rounded border border-indigo-200 cursor-pointer p-0.5" />
            <input type="text" value={meta.accentColor}
              onChange={(e) => setMeta({ accentColor: e.target.value })}
              placeholder="#0066cc" className="flex-1 border border-indigo-200 rounded px-2 py-1 text-xs font-mono bg-white/70 focus:outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
      </div>

      {/* Margins */}
      <div>
        <label className={labelClass}>
          Page margins — <span className="font-mono">{meta.pageMargins.toFixed(1)}&quot;</span>
        </label>
        <input type="range" min={0.5} max={1.5} step={0.1}
          value={meta.pageMargins}
          onChange={(e) => setMeta({ pageMargins: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600" />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>0.5&quot; (min)</span><span>1.5&quot;</span>
        </div>
      </div>

      {/* Line spacing */}
      <div>
        <label className={labelClass}>
          Line spacing — <span className="font-mono">{meta.lineSpacing.toFixed(2)}</span>
        </label>
        <input type="range" min={1.0} max={1.15} step={0.05}
          value={meta.lineSpacing}
          onChange={(e) => setMeta({ lineSpacing: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600" />
        <div className="flex justify-between text-xs text-gray-400 mt-0.5">
          <span>1.00</span><span>1.15</span>
        </div>
      </div>

    </div>
  )
}
