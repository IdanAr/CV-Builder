'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from '@/lib/stores/toast.store'

/**
 * Per-CV download, track and duplicate handlers. Deleting is not here: its
 * undo window must outlive the row, so it belongs to the library
 * (`useCvDeletion`).
 */
export function useResumeActions({ id, title }: { id: string; title: string }) {
  const router = useRouter()
  const [duplicating, setDuplicating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [tracking, setTracking] = useState(false)

  // Creates an Application pre-filled from this resume (the server pulls its
  // targetCompany/targetRole) and jumps to the applications supertable.
  async function handleTrack() {
    if (tracking) return
    setTracking(true)
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeId: id }),
      })
      if (!res.ok) throw new Error('Track failed')
      router.push('/dashboard/applications')
    } catch (err) {
      console.error(err)
      toast.error(`Could not start tracking an application for "${title}". Please try again.`)
      setTracking(false)
    }
  }

  async function handleDuplicate() {
    setDuplicating(true)
    try {
      const res = await fetch(`/api/resumes/${id}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Duplicate failed')
      toast.success(`Duplicated "${title}"`)
      router.refresh()
    } catch (err) {
      console.error(err)
      toast.error(`Could not duplicate "${title}". Please try again.`)
    } finally {
      setDuplicating(false)
    }
  }

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      const res = await fetch(`/api/resumes/${id}`)
      if (!res.ok) throw new Error('Fetch failed')
      const { resume: full } = await res.json()
      const blob = new Blob([JSON.stringify(full.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${title}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      toast.error(`Could not download "${title}" as JSON. Please try again.`)
    } finally {
      setDownloading(false)
    }
  }

  return {
    downloading,
    tracking,
    duplicating,
    download: handleDownload,
    track: handleTrack,
    duplicate: handleDuplicate,
  }
}
