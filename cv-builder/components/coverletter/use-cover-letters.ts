'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { apiErrorMessage } from '@/lib/api/client-errors'
import type { LetterDesign } from '@/lib/coverletter/design'
// Types only: importing the values would drag mongoose into the client bundle.
import type { CoverLetterDetail, CoverLetterView, SuggestedPosting } from '@/lib/api/cover-letters'
import type {
  CoverLetterNotes,
  CreateCoverLetterInput,
  UpdateCoverLetterInput,
} from '@/lib/schemas/cover-letter.zod'

export interface UseCoverLetters {
  letters: CoverLetterView[]
  /** Notes from the most recent letter, to prefill the next one. */
  prefillNotes: CoverLetterNotes
  suggestedPosting: SuggestedPosting | null
  loading: boolean
  error: string | null
  /** Starts a letter (status 'writing') and polls it until it settles. Null when the request failed. */
  create(input: CreateCoverLetterInput): Promise<CoverLetterView | null>
  /** Optimistic edit. `content` is debounced; every other field is sent at once. */
  save(id: string, patch: UpdateCoverLetterInput): void
  remove(id: string): Promise<void>
  /**
   * Sends the held content edit now and resolves once every save in flight has settled.
   * Never throws. Resolves false when a save failed (also reported through `error`) or
   * the text on the server is older than the text on screen, true when everything is saved.
   */
  flush(): Promise<boolean>
  /** The posting of a failed letter, read from the server for Try again; null when there is none or the read fails. */
  postingFor(id: string): Promise<string | null>
}

const POLL_MS = 2000
const SAVE_DEBOUNCE_MS = 800

const LOAD_ERROR = 'Failed to load cover letters.'
const CREATE_ERROR = 'Failed to start the cover letter.'
const SAVE_ERROR = 'Failed to save the cover letter.'
const DELETE_ERROR = 'Failed to delete the cover letter.'

/** The part of a letter a failed save has to put back. */
interface Previous {
  design?: LetterDesign
  pendingApprovals: string[]
}

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** The last content edit that has not been sent yet. */
interface PendingContent {
  resumeId: string
  id: string
  content: string
  timer: ReturnType<typeof setTimeout>
}

/**
 * Reads and edits the cover letters of one CV: the list, creation (the letter
 * is written by a background job, so a new one is polled until it settles),
 * debounced autosave of the text, and deletion.
 */
export function useCoverLetters(resumeId: string | null): UseCoverLetters {
  const [letters, setLetters] = useState<CoverLetterView[]>([])
  const [prefillNotes, setPrefillNotes] = useState<CoverLetterNotes>({})
  const [suggestedPosting, setSuggestedPosting] = useState<SuggestedPosting | null>(null)
  const [loading, setLoading] = useState(resumeId !== null)
  const [error, setError] = useState<string | null>(null)

  // Mirrors of state the async callbacks need without re-creating themselves.
  const lettersRef = useRef<CoverLetterView[]>([])
  const resumeRef = useRef<string | null>(resumeId)
  const aliveRef = useRef(true)
  const pendingRef = useRef<PendingContent | null>(null)
  // Saves that have been sent and not yet answered, so flush can wait for them.
  const inflightRef = useRef(new Set<Promise<boolean>>())
  // Text whose last save failed and has not been sent again, so a later flush
  // can retry it instead of calling the letter saved.
  const unsavedRef = useRef(new Map<string, { resumeId: string; content: string }>())
  // Bumped by every save of a letter; a response that finds the number moved on
  // knows the user kept typing and must not overwrite the local text.
  const editSeqRef = useRef(new Map<string, number>())

  const update = useCallback((fn: (prev: CoverLetterView[]) => CoverLetterView[]) => {
    const next = fn(lettersRef.current)
    lettersRef.current = next
    setLetters(next)
  }, [])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // Load the list whenever the CV changes.
  useEffect(() => {
    resumeRef.current = resumeId
    unsavedRef.current.clear()
    update(() => [])
    // Switching CV resets everything that belonged to the previous one.
    /* eslint-disable react-hooks/set-state-in-effect */
    setPrefillNotes({})
    setSuggestedPosting(null)
    setError(null)
    if (!resumeId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    /* eslint-enable react-hooks/set-state-in-effect */
    ;(async () => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}/cover-letters`)
        if (cancelled) return
        if (!res.ok) {
          setError(await apiErrorMessage(res, LOAD_ERROR))
          return
        }
        const body = (await res.json()) as {
          letters: CoverLetterView[]
          notes: CoverLetterNotes
          suggestedPosting: SuggestedPosting | null
        }
        if (cancelled) return
        update(() => body.letters)
        setPrefillNotes(body.notes ?? {})
        setSuggestedPosting(body.suggestedPosting ?? null)
      } catch {
        if (!cancelled) setError(LOAD_ERROR)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [resumeId, update])

  // Polling: one timeout loop while any letter is still being written.
  const anyWriting = letters.some((l) => l.status === 'writing')
  useEffect(() => {
    if (!resumeId || !anyWriting) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    const pollOne = async (id: string) => {
      try {
        const res = await fetch(`/api/resumes/${resumeId}/cover-letters/${id}`)
        if (cancelled) return
        if (res.status === 404) {
          update((prev) => prev.filter((l) => l.id !== id))
          return
        }
        if (!res.ok) return
        // A letter that just failed comes back with its posting; the list keeps letters without one.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { jobText, ...letter } = ((await res.json()) as { letter: CoverLetterDetail }).letter
        if (cancelled) return
        // Only a letter still marked writing is replaced, so a late poll cannot undo a newer state.
        update((prev) => prev.map((l) => (l.id === id && l.status === 'writing' ? letter : l)))
      } catch {
        // A failed poll is retried on the next tick.
      }
    }

    const tick = async () => {
      const writing = lettersRef.current.filter((l) => l.status === 'writing')
      await Promise.all(writing.map((l) => pollOne(l.id)))
      if (cancelled || !lettersRef.current.some((l) => l.status === 'writing')) return
      timer = setTimeout(tick, POLL_MS)
    }

    timer = setTimeout(tick, POLL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [resumeId, anyWriting, update])

  /** Resolves true when the server stored the patch. Handles its own errors, so it never rejects. */
  const sendPatch = useCallback(
    async (rid: string, id: string, patch: UpdateCoverLetterInput, seq: number, previous?: Previous): Promise<boolean> => {
      // A value the server did not store must not stay on screen. Only undone
      // while the screen still shows this save's value, so a newer one survives.
      const revert = () => {
        if (!previous) return
        update((prev) =>
          prev.map((l) => {
            if (l.id !== id) return l
            let next = l
            if (patch.design !== undefined && l.design === patch.design) next = { ...next, design: previous.design }
            if (patch.pendingApprovals !== undefined && l.pendingApprovals === patch.pendingApprovals) {
              next = { ...next, pendingApprovals: previous.pendingApprovals }
            }
            return next
          })
        )
      }
      const failed = () => {
        if (patch.content !== undefined) unsavedRef.current.set(id, { resumeId: rid, content: patch.content })
      }
      try {
        const res = await fetch(`/api/resumes/${rid}/cover-letters/${id}`, {
          method: 'PATCH',
          headers: JSON_HEADERS,
          body: JSON.stringify(patch),
        })
        // Nothing to update once the hook is gone or showing another CV.
        if (!aliveRef.current || resumeRef.current !== rid) return false
        if (!res.ok) {
          failed()
          revert()
          setError(await apiErrorMessage(res, SAVE_ERROR))
          return false
        }
        // A newer content edit is still held or on its way, so only an older failure is cleared.
        if (patch.content !== undefined && (editSeqRef.current.get(id) ?? 0) === seq) unsavedRef.current.delete(id)
        const { letter } = (await res.json()) as { letter: CoverLetterView }
        if (!aliveRef.current || resumeRef.current !== rid) return true
        const keepLocalText =
          (editSeqRef.current.get(id) ?? 0) !== seq || pendingRef.current?.id === id
        update((prev) =>
          prev.map((l) =>
            l.id === id
              ? keepLocalText
                ? { ...letter, content: l.content, notes: l.notes, design: l.design }
                : letter
              : l
          )
        )
        return true
      } catch {
        if (aliveRef.current && resumeRef.current === rid) {
          failed()
          revert()
          setError(SAVE_ERROR)
        }
        return false
      }
    },
    [update]
  )

  /** Sends a save and tracks it until it settles. */
  const track = useCallback(
    (rid: string, id: string, patch: UpdateCoverLetterInput, seq: number, previous?: Previous) => {
      const p = sendPatch(rid, id, patch, seq, previous).finally(() => inflightRef.current.delete(p))
      inflightRef.current.add(p)
      return p
    },
    [sendPatch]
  )

  /** Sends the held content edit now. */
  const flushPending = useCallback(() => {
    const pending = pendingRef.current
    if (!pending) return
    clearTimeout(pending.timer)
    pendingRef.current = null
    void track(pending.resumeId, pending.id, { content: pending.content }, editSeqRef.current.get(pending.id) ?? 0)
  }, [track])

  const flush = useCallback(async (): Promise<boolean> => {
    flushPending()
    // Text a save left behind earlier is sent again, unless a newer edit has taken its place.
    for (const [id, unsaved] of [...unsavedRef.current]) {
      if (resumeRef.current !== unsaved.resumeId) continue
      void track(unsaved.resumeId, id, { content: unsaved.content }, editSeqRef.current.get(id) ?? 0)
    }
    const results = await Promise.all([...inflightRef.current])
    return results.every(Boolean) && unsavedRef.current.size === 0
  }, [flushPending, track])

  // Switching CV or leaving the editor must not drop the last keystrokes.
  useEffect(() => flushPending, [resumeId, flushPending])

  const save = useCallback(
    (id: string, patch: UpdateCoverLetterInput) => {
      if (!resumeId) return
      if (pendingRef.current && pendingRef.current.id !== id) flushPending()

      const seq = (editSeqRef.current.get(id) ?? 0) + 1
      editSeqRef.current.set(id, seq)
      setError(null)
      const current = lettersRef.current.find((l) => l.id === id)
      const previous: Previous | undefined = current
        ? { design: current.design, pendingApprovals: current.pendingApprovals }
        : undefined
      update((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))

      const { content, ...rest } = patch
      if (Object.keys(rest).length > 0) void track(resumeId, id, rest, seq, previous)
      if (content !== undefined) {
        if (pendingRef.current) clearTimeout(pendingRef.current.timer)
        pendingRef.current = {
          resumeId,
          id,
          content,
          timer: setTimeout(flushPending, SAVE_DEBOUNCE_MS),
        }
      }
    },
    [resumeId, flushPending, track, update]
  )

  const create = useCallback(
    async (input: CreateCoverLetterInput): Promise<CoverLetterView | null> => {
      if (!resumeId) return null
      setError(null)
      try {
        const res = await fetch(`/api/resumes/${resumeId}/cover-letters`, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify(input),
        })
        if (!res.ok) {
          if (aliveRef.current && resumeRef.current === resumeId) {
            setError(await apiErrorMessage(res, CREATE_ERROR))
          }
          return null
        }
        const { letter } = (await res.json()) as { letter: CoverLetterView }
        if (aliveRef.current && resumeRef.current === resumeId) {
          update((prev) => [letter, ...prev.filter((l) => l.id !== letter.id)])
        }
        return letter
      } catch {
        if (aliveRef.current && resumeRef.current === resumeId) setError(CREATE_ERROR)
        return null
      }
    },
    [resumeId, update]
  )

  const remove = useCallback(
    async (id: string) => {
      if (!resumeId) return
      setError(null)
      // An edit waiting for the debounce would only resurrect a letter being deleted.
      unsavedRef.current.delete(id)
      if (pendingRef.current?.id === id) {
        clearTimeout(pendingRef.current.timer)
        pendingRef.current = null
      }
      try {
        const res = await fetch(`/api/resumes/${resumeId}/cover-letters/${id}`, { method: 'DELETE' })
        if (!aliveRef.current || resumeRef.current !== resumeId) return
        // A 404 means the letter is already gone, which is what was asked for.
        if (res.ok || res.status === 404) {
          update((prev) => prev.filter((l) => l.id !== id))
        } else {
          setError(await apiErrorMessage(res, DELETE_ERROR))
        }
      } catch {
        if (aliveRef.current && resumeRef.current === resumeId) setError(DELETE_ERROR)
      }
    },
    [resumeId, update]
  )

  const postingFor = useCallback(
    async (id: string): Promise<string | null> => {
      if (!resumeId) return null
      try {
        const res = await fetch(`/api/resumes/${resumeId}/cover-letters/${id}`)
        if (!res.ok) return null
        const { letter } = (await res.json()) as { letter: CoverLetterDetail }
        return letter.jobText || null
      } catch {
        return null
      }
    },
    [resumeId]
  )

  return { letters, prefillNotes, suggestedPosting, loading, error, create, save, remove, flush, postingFor }
}
