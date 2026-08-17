'use client'

import React from 'react'

interface Props { children: React.ReactNode }
interface State { hasError: boolean; confirmingReload: boolean }

export class EditorErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, confirmingReload: false }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.state.confirmingReload) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
          <h2 className="text-lg font-semibold text-indigo-900">Reload the editor?</h2>
          <p className="text-sm text-indigo-600">Any unsaved changes will be lost.</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Reload
            </button>
            <button
              onClick={() => this.setState({ confirmingReload: false })}
              className="rounded-md border border-indigo-200 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-lg font-semibold text-indigo-900">Something went wrong</h2>
        <button
          onClick={() => this.setState({ confirmingReload: true })}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Reload editor
        </button>
      </div>
    )
  }
}
