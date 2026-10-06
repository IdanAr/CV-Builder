'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast, useToastStore } from '@/lib/stores/toast.store'
import { onToastPause, onToastResume } from '@/components/ui/Toaster'

const UNDO_DELETE_DURATION = 6000

export function useResumeActions({ id, title }: { id: string; title: string }) {
  const router = useRouter()
  const [duplicating, setDuplicating] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [tracking, setTracking] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  const deleteTimerRef = useRef<number | null>(null)
  const undoToastIdRef = useRef<number | null>(null)
  // Tracks the undo window's remaining time so a hover/focus pause on the
  // toast (see Toaster.tsx) can resume the countdown instead of resetting it.
  const remainingRef = useRef(UNDO_DELETE_DURATION)
  const startedAtRef = useRef(0)
  const cancelledRef = useRef(false)

  async function commitDelete() {
    try {
      const res = await fetch(`/api/resumes/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      router.refresh()
    } catch (err) {
      console.error(err)
      setPendingDelete(false)
      toast.error(`Could not delete "${title}". It has been restored.`)
    }
  }

  function startDeleteTimer(ms: number) {
    startedAtRef.current = Date.now()
    remainingRef.current = ms
    deleteTimerRef.current = window.setTimeout(() => {
      deleteTimerRef.current = null
      if (undoToastIdRef.current !== null) useToastStore.getState().dismiss(undoToastIdRef.current)
      void commitDelete()
    }, ms)
  }

  function pauseDeleteTimer() {
    if (deleteTimerRef.current === null) return
    const elapsed = Date.now() - startedAtRef.current
    remainingRef.current = Math.max(0, remainingRef.current - elapsed)
    window.clearTimeout(deleteTimerRef.current)
    deleteTimerRef.current = null
  }

  function resumeDeleteTimer() {
    if (deleteTimerRef.current !== null) return
    if (cancelledRef.current) return
    startDeleteTimer(remainingRef.current)
  }

  function handleDelete() {
    cancelledRef.current = false
    setPendingDelete(true)
    undoToastIdRef.current = toast.withAction(
      `Deleted "${title}"`,
      'Undo',
      () => {
        cancelledRef.current = true
        if (deleteTimerRef.current) window.clearTimeout(deleteTimerRef.current)
        deleteTimerRef.current = null
        setPendingDelete(false)
      }
    )
    startDeleteTimer(UNDO_DELETE_DURATION)
  }

  // Subscribe once to the Toaster's pause/resume bus so a hover or focus on
  // the undo-delete toast pauses this component's own deletion countdown
  // (the toast's own visual dismiss timer lives in Toaster.tsx and is paused
  // independently, in lockstep, via the same hover/focus interaction).
  useEffect(() => {
    const unsubPause = onToastPause((id) => {
      if (undoToastIdRef.current === id) pauseDeleteTimer()
    })
    const unsubResume = onToastResume((id) => {
      if (undoToastIdRef.current === id) resumeDeleteTimer()
    })
    return () => {
      unsubPause()
      unsubResume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) {
        window.clearTimeout(deleteTimerRef.current)
        void fetch(`/api/resumes/${id}`, { method: 'DELETE' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    hidden: pendingDelete,
    busy: duplicating || tracking,
    downloading,
    tracking,
    duplicating,
    download: handleDownload,
    track: handleTrack,
    duplicate: handleDuplicate,
    remove: handleDelete,
  }
}
