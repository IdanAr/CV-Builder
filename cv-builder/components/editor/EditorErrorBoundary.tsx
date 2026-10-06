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
          <h2 className="text-lg font-semibold text-fg-heading">Reload the editor?</h2>
          <p className="text-sm text-fg-muted">Any unsaved changes will be lost.</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-danger-600 px-4 py-2 text-sm font-medium text-white hover:bg-danger-700"
            >
              Reload
            </button>
            <button
              onClick={() => this.setState({ confirmingReload: false })}
              className="rounded-md border border-accent-200 px-4 py-2 text-sm font-medium text-accent-600 hover:bg-accent-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <h2 className="text-lg font-semibold text-fg-heading">Something went wrong</h2>
        <button
          onClick={() => this.setState({ confirmingReload: true })}
          className="rounded-md bg-accent-600 px-4 py-2 text-sm font-medium text-white hover:bg-accent-700"
        >
          Reload editor
        </button>
      </div>
    )
  }
}
