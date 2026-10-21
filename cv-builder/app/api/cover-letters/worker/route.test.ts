import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockRunJob } = vi.hoisted(() => ({ mockRunJob: vi.fn() }))

vi.mock('@upstash/qstash/nextjs', () => ({
  verifySignatureAppRouter: (handler: unknown) => handler,
}))
vi.mock('@/lib/ai/cover-letter/job', () => ({ runCoverLetterJob: mockRunJob }))

import { POST } from './route'

beforeEach(() => {
  vi.clearAllMocks()
})

function req(body: unknown, raw = false) {
  return new Request('http://test/api/cover-letters/worker', {
    method: 'POST',
    // The verifier is mocked away; the route itself only checks the header is present.
    headers: { 'Upstash-Signature': 'stub' },
    body: raw ? (body as string) : JSON.stringify(body),
  })
}

describe('POST /api/cover-letters/worker', () => {
  it('runs the job and returns its outcome', async () => {
    mockRunJob.mockResolvedValue('written')

    const res = (await POST(req({ userId: 'u1', letterId: 'l1' }) as never, undefined as never)) as Response

    expect(mockRunJob).toHaveBeenCalledWith('u1', 'l1')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ outcome: 'written' })
  })

  it.each(['gone', 'already-started', 'failed'])('answers 200 for the %s outcome so QStash does not retry', async (outcome) => {
    mockRunJob.mockResolvedValue(outcome)

    const res = (await POST(req({ userId: 'u1', letterId: 'l1' }) as never, undefined as never)) as Response

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ outcome })
  })

  it('rejects a missing letterId with 400', async () => {
    const res = (await POST(req({ userId: 'u1' }) as never, undefined as never)) as Response
    expect(res.status).toBe(400)
    expect(mockRunJob).not.toHaveBeenCalled()
  })

  it('rejects a missing or non-string userId with 400', async () => {
    expect(((await POST(req({ letterId: 'l1' }) as never, undefined as never)) as Response).status).toBe(400)
    expect(((await POST(req({ userId: 5, letterId: 'l1' }) as never, undefined as never)) as Response).status).toBe(400)
    expect(mockRunJob).not.toHaveBeenCalled()
  })

  it('rejects a body that is not JSON with 400', async () => {
    const res = (await POST(req('not json', true) as never, undefined as never)) as Response
    expect(res.status).toBe(400)
    expect(mockRunJob).not.toHaveBeenCalled()
  })

  it('answers 500 when the job throws before it could claim the letter, so QStash retries', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockRunJob.mockRejectedValue(new Error('db down'))

    const res = (await POST(req({ userId: 'u1', letterId: 'l1' }) as never, undefined as never)) as Response

    expect(res.status).toBe(500)
    log.mockRestore()
  })
})
