'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { apiErrorMessage } from '@/lib/api/client-errors'
import { requestErrorMessage } from '@/lib/fetch-with-timeout'

/**
 * Self-serve data export — one half of what app/privacy/page.tsx promises under
 * "your rights", and which until now could only be exercised by emailing
 * support and waiting.
 *
 * Fetched into a blob rather than served by a plain `<a download>` so the wait
 * is visible and a failure is reportable. The export walks seven collections;
 * a link that appears to do nothing for two seconds and then silently fails is
 * exactly the loading-state gap this audit is about.
 */
export function ExportDataSection() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Could not prepare your export. Please try again.'))

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cv-builder-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(requestErrorMessage(err, 'Could not prepare your export. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card padding="lg" className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-fg-heading">Export your data</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Downloads everything stored in your account as a single JSON file — résumés, cover letters,
          job applications and their history, board setup, and job-search profiles and rules.
        </p>
        {/* Stated plainly rather than buried: someone exporting their data
            deserves to know what the file does not contain, and why. */}
        <p className="mt-2 text-sm text-fg-muted">
          Sign-in tokens for your Google or GitHub account are not included, so the file cannot be used
          to access anything on your behalf.
        </p>
      </div>

      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Button variant="secondary" size="md" onClick={handleExport} disabled={busy}>
        <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
        {busy ? 'Preparing your file…' : 'Download my data'}
      </Button>
    </Card>
  )
}
