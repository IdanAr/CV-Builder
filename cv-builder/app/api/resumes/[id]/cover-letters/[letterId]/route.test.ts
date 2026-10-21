import { describe, it, expect, vi, afterEach } from 'vitest'

// A module exports several auth()-wrapped handlers, so the session is read when a
// request arrives instead of being consumed once when the module is imported.
const session = vi.hoisted(() => ({ current: null as { user: { id: string } } | null }))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn((handler) => async (req: Request, ctx: unknown) => {
    return handler(Object.assign(req, { auth: session.current }), ctx)
  }),
}))

vi.mock('@/lib/api/resumes', () => ({
  getResume: vi.fn(),
}))

vi.mock('@/lib/api/cover-letters', () => ({
  getCoverLetter: vi.fn(),
  updateCoverLetter: vi.fn(),
  deleteCoverLetter: vi.fn(),
}))

const ctx = { params: Promise.resolve({ id: 'cv-1', letterId: 'l1' }) } as never

function signIn() {
  session.current = { user: { id: 'user-1' } }
}

function patch(body: unknown) {
  return new Request('http://localhost/api/resumes/cv-1/cover-letters/l1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

const plain = () => new Request('http://localhost/api/resumes/cv-1/cover-letters/l1')

async function ownCv() {
  const { getResume } = await import('@/lib/api/resumes')
  vi.mocked(getResume).mockResolvedValueOnce({ title: 'My CV' } as never)
}

describe('/api/resumes/[id]/cover-letters/[letterId]', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    session.current = null
  })

  describe('GET', () => {
    it('returns 401 when not authenticated', async () => {
      const { GET } = await import('./route')
      expect(((await GET(plain() as never, ctx)) as Response).status).toBe(401)
    })

    it('returns 404 when the CV is not the users', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce(null as never)
      const api = await import('@/lib/api/cover-letters')

      const { GET } = await import('./route')
      expect(((await GET(plain() as never, ctx)) as Response).status).toBe(404)
      expect(api.getCoverLetter).not.toHaveBeenCalled()
    })

    it('returns 404 when the letter does not exist', async () => {
      signIn()
      await ownCv()
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.getCoverLetter).mockResolvedValueOnce(null)

      const { GET } = await import('./route')
      expect(((await GET(plain() as never, ctx)) as Response).status).toBe(404)
      expect(api.getCoverLetter).toHaveBeenCalledWith('user-1', 'cv-1', 'l1')
    })

    it('returns the letter', async () => {
      signIn()
      await ownCv()
      const api = await import('@/lib/api/cover-letters')
      const letter = { id: 'l1', status: 'ready', content: 'Hello' }
      vi.mocked(api.getCoverLetter).mockResolvedValueOnce(letter as never)

      const { GET } = await import('./route')
      const res = (await GET(plain() as never, ctx)) as Response
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ letter })
    })
  })

  describe('PATCH', () => {
    it('returns 401 when not authenticated', async () => {
      const { PATCH } = await import('./route')
      expect(((await PATCH(patch({ content: 'x' }) as never, ctx)) as Response).status).toBe(401)
    })

    it('returns 404 when the CV is not the users', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce(null as never)

      const { PATCH } = await import('./route')
      expect(((await PATCH(patch({ content: 'x' }) as never, ctx)) as Response).status).toBe(404)
    })

    it('returns 400 with the Zod issues for an invalid body', async () => {
      signIn()
      await ownCv()
      const api = await import('@/lib/api/cover-letters')

      const { PATCH } = await import('./route')
      const res = (await PATCH(patch({ content: 42 }) as never, ctx)) as Response
      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toMatchObject({ code: 'VALIDATION_ERROR' })
      expect(json.details[0]).toMatchObject({ path: ['content'] })
      expect(api.updateCoverLetter).not.toHaveBeenCalled()
    })

    it('returns 404 when the letter does not exist', async () => {
      signIn()
      await ownCv()
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.updateCoverLetter).mockResolvedValueOnce(null)

      const { PATCH } = await import('./route')
      expect(((await PATCH(patch({ content: 'x' }) as never, ctx)) as Response).status).toBe(404)
    })

    it('returns 409 CONFLICT when the letter is still being written', async () => {
      signIn()
      await ownCv()
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.updateCoverLetter).mockResolvedValueOnce('writing')

      const { PATCH } = await import('./route')
      const res = (await PATCH(patch({ content: 'x' }) as never, ctx)) as Response
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ code: 'CONFLICT', error: 'This letter is still being written.' })
    })

    it('returns the updated letter', async () => {
      signIn()
      await ownCv()
      const api = await import('@/lib/api/cover-letters')
      const letter = { id: 'l1', status: 'ready', content: 'Edited' }
      vi.mocked(api.updateCoverLetter).mockResolvedValueOnce(letter as never)

      const { PATCH } = await import('./route')
      const res = (await PATCH(patch({ content: 'Edited' }) as never, ctx)) as Response
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ letter })
      expect(api.updateCoverLetter).toHaveBeenCalledWith('user-1', 'cv-1', 'l1', { content: 'Edited' })
    })
  })

  describe('DELETE', () => {
    it('returns 401 when not authenticated', async () => {
      const { DELETE } = await import('./route')
      expect(((await DELETE(plain() as never, ctx)) as Response).status).toBe(401)
    })

    it('returns 404 when the CV is not the users', async () => {
      signIn()
      const { getResume } = await import('@/lib/api/resumes')
      vi.mocked(getResume).mockResolvedValueOnce(null as never)
      const api = await import('@/lib/api/cover-letters')

      const { DELETE } = await import('./route')
      expect(((await DELETE(plain() as never, ctx)) as Response).status).toBe(404)
      expect(api.deleteCoverLetter).not.toHaveBeenCalled()
    })

    it('returns 404 when the letter does not exist', async () => {
      signIn()
      await ownCv()
      const api = await import('@/lib/api/cover-letters')
      vi.mocked(api.deleteCoverLetter).mockResolvedValueOnce(false)

      const { DELETE } = await import('./route')
      expect(((await DELETE(plain() as never, ctx)) as Response).status).toBe(404)
    })

    it('answers 204, after which the letter is gone', async () => {
      const api = await import('@/lib/api/cover-letters')
      const { DELETE, GET } = await import('./route')

      signIn()
      await ownCv()
      vi.mocked(api.deleteCoverLetter).mockResolvedValueOnce(true)
      const del = (await DELETE(plain() as never, ctx)) as Response
      expect(del.status).toBe(204)
      expect(api.deleteCoverLetter).toHaveBeenCalledWith('user-1', 'cv-1', 'l1')

      signIn()
      await ownCv()
      vi.mocked(api.getCoverLetter).mockResolvedValueOnce(null)
      expect(((await GET(plain() as never, ctx)) as Response).status).toBe(404)
    })
  })
})
