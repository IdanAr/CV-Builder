'use client'

import React from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

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
        <div className="flex h-full items-center justify-center p-8">
          <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-xl font-medium text-fg-heading">Reload the editor?</h2>
            <p className="text-sm text-fg-muted">Any unsaved changes will be lost.</p>
            <div className="flex gap-3">
              <Button variant="danger" size="md" onClick={() => window.location.reload()}>
                Reload
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={() => this.setState({ confirmingReload: false })}
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )
    }

    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card padding="lg" className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-xl font-medium text-fg-heading">Something went wrong</h2>
          <Button size="md" onClick={() => this.setState({ confirmingReload: true })}>
            Reload editor
          </Button>
        </Card>
      </div>
    )
  }
}
