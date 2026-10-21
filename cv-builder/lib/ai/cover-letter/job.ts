// lib/ai/cover-letter/job.ts
// The background job that writes one cover letter. The create route stores a
// "writing" record and enqueues this (lib/ai/cover-letter/queue.ts); the
// writer takes ~45-53 s, longer than a request should wait. The job never
// touches the ScrapedJob a letter links to; scrapedJobId is only a link back.
import dbConnect from '@/lib/db'
import CoverLetter from '@/models/CoverLetter'
import Resume from '@/models/Resume'
import type { ProgressStep } from './pipeline'
import { writeCoverLetterWithCritique } from './write-with-critique'

export type JobOutcome = 'written' | 'already-started' | 'gone' | 'failed'

export const FAILED_MESSAGE = 'Could not write this letter. Please try again.'
/** The worker route's maxDuration is 60 s; this leaves room to store the result. */
const WRITE_DEADLINE_MS = 55_000
const OBJECT_ID = /^[0-9a-f]{24}$/i

export async function runCoverLetterJob(userId: string, letterId: string): Promise<JobOutcome> {
  // A malformed id would throw a CastError from every query below.
  if (!OBJECT_ID.test(letterId)) return 'gone'
  await dbConnect()

  // Claim the letter: a redelivery (QStash retry, or both the queue and
  // after() running) finds startedAt set and stops here, so the writer, which
  // costs real money, runs once per letter.
  const letter = await CoverLetter.findOneAndUpdate(
    { _id: letterId, userId, status: 'writing', startedAt: { $exists: false } },
    { $set: { startedAt: new Date() } },
    { returnDocument: 'after' }
  ).lean()
  if (!letter) {
    return (await CoverLetter.exists({ _id: letterId, userId })) ? 'already-started' : 'gone'
  }

  // Every later write only applies while the letter is still "writing": the
  // stale rule in lib/api/cover-letters.ts may have failed it meanwhile, and
  // that (or a delete) must not be undone by a job that finished late.
  const stillWriting = { _id: letterId, status: 'writing' }

  try {
    if (!OBJECT_ID.test(letter.resumeId)) return 'gone'
    const resume = await Resume.findOne({ _id: letter.resumeId, userId }).lean()
    if (!resume) return 'gone'

    const run = await writeCoverLetterWithCritique(
      resume.data,
      { company: letter.company, role: letter.role, jobText: letter.jobText },
      {
        deadlineMs: WRITE_DEADLINE_MS,
        notes: letter.notes,
        // Fire and forget: a lost progress write only leaves the bar a step behind.
        onProgress: (step: ProgressStep) => {
          void CoverLetter.updateOne(stillWriting, { $set: { progress: step } }).then(undefined, () => {})
        },
      }
    )

    const saved = await CoverLetter.updateOne(stillWriting, {
      $set: {
        status: 'ready',
        content: run.content,
        pendingApprovals: run.pendingApprovals,
        notices: run.notices,
        language: run.language,
      },
      $unset: { error: '' },
    })
    // Nothing matched: the letter was deleted or already failed as stale, and
    // the finished text is dropped.
    return saved.matchedCount === 0 ? 'gone' : 'written'
  } catch (err) {
    // Name and message only: an error object can carry the request, which holds the CV.
    const detail = err instanceof Error ? `${err.name}: ${err.message.slice(0, 300)}` : 'non-Error thrown'
    console.error(`[cover-letter job] letter ${letterId} failed`, detail)
    try {
      await CoverLetter.updateOne(stillWriting, { $set: { status: 'failed', error: FAILED_MESSAGE } })
    } catch (writeErr) {
      // The stale rule fails the letter on its next read anyway.
      console.error(`[cover-letter job] letter ${letterId} could not be marked failed`, writeErr instanceof Error ? writeErr.name : 'unknown')
    }
    return 'failed'
  }
}
